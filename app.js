let appData = JSON.parse(localStorage.getItem('hourBankAppData'));
let cloudConfig = JSON.parse(localStorage.getItem('hourBankCloudConfig')) || { token: '', gistId: '' };

if (!appData) {
    const legacyData = JSON.parse(localStorage.getItem('dutchMasteryData'));
    if (legacyData) {
        appData = {
            activeWorkspace: "Dutch Study",
            isDarkMode: legacyData.isDarkMode || false,
            workspaces: {
                "Dutch Study": {
                    totalMinutes: legacyData.totalMinutes || 0,
                    books: legacyData.books || [],
                    maxHours: legacyData.maxHours || 730,
                    activityLog: legacyData.activityLog || [],
                    mode: 'time',
                    unitLabel: 'Hours'
                }
            }
        };
    } else {
        appData = {
            activeWorkspace: "Main Subject",
            isDarkMode: false,
            workspaces: {
                "Main Subject": { totalMinutes: 0, books: [], maxHours: 730, activityLog: [], mode: 'time', unitLabel: 'Hours' }
            }
        };
    }
    Object.values(appData.workspaces).forEach(ws => {
        if (!ws.mode) ws.mode = 'time';
        if (!ws.unitLabel) ws.unitLabel = 'Hours';
    });
} else {
    Object.values(appData.workspaces).forEach(ws => {
        if (!ws.mode) ws.mode = 'time';
        if (!ws.unitLabel) ws.unitLabel = 'Hours';
    });
}

let studyData = appData.workspaces[appData.activeWorkspace];

let chartInstance = null;
let isChartExpanded = false;
let pendingBookEdit = null;
let pendingLogsEdit = null;

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
}

function init() {
    renderWorkspaceDropdown();
    syncTotals();
    renderDashboard();
    renderChart();
    
    if (appData.isDarkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-btn').textContent = '☀️ Light Mode';
    }
}

function syncTotals() {
    studyData.totalMinutes = 0;
    studyData.books.forEach(book => {
        if (studyData.mode === 'auto') {
            book.hours = (book.done || []).length;
        } else {
            const bookLogs = (studyData.activityLog || []).filter(l => l.bookId === book.id && l.type === 'minutes');
            book.hours = bookLogs.reduce((sum, log) => sum + parseFloat(log.value || 0), 0);
        }
        studyData.totalMinutes += book.hours;
    });
}

function renderDashboard() {
    const tableBody = document.getElementById('book-rows');
    tableBody.innerHTML = '';
    
    studyData.books.forEach(book => {
        const row = document.createElement('tr');
        
        // Calculate Days Left
        const today = new Date();
        let accessStatus = "No limit";
        let accessClass = "";
        if (book.expiryDate) {
            const expiry = new Date(book.expiryDate);
            const diffTime = expiry - today;
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            accessStatus = daysLeft < 0 ? "Expired" : `${daysLeft} days`;
            accessClass = daysLeft < 30 ? 'danger' : '';
        }

        let effortDisplay = '';
        let effortInput = '';
        
        if (studyData.mode === 'auto') {
            effortDisplay = book.hours;
        } else if (studyData.mode === 'unit') {
            effortDisplay = book.hours;
            effortInput = `<input type="number" placeholder="+ val" onchange="addMinutes(${book.id}, this.value)" class="input-hours" style="width: 75px;">`;
        } else {
            effortDisplay = `${Math.floor(book.hours / 60)}:${Math.floor(book.hours % 60).toString().padStart(2, '0')}`;
            effortInput = `<input type="number" placeholder="+ mins" onchange="addMinutes(${book.id}, this.value)" class="input-hours" style="width: 75px;">`;
        }

        row.innerHTML = `
            <td><strong>${escapeHTML(book.name)}</strong></td>
            <td>
                <div class="effort-cell">
                    <span class="effort-val">${effortDisplay}</span>
                    ${effortInput}
                </div>
            </td>
            <td>
                <div class="chapter-controls">
                    <div class="chapter-grid">
                        ${Array.from({length: Math.max(0, book.chapters || 0)}, (_, i) => `
                            <div class="chapter-box ${(book.done || []).includes(i+1) ? 'done' : ''}" 
                                 onclick="toggleChapter(${book.id}, ${i+1})">${i+1}</div>
                        `).join('')}
                    </div>
                </div>
            </td>
            <td class="${accessClass}">${accessStatus}</td>
            <td>
                <div class="action-cell">
                    <button class="btn-icon" onclick="moveBookUp(${book.id})" title="Move Up">↑</button>
                    <button class="btn-icon" onclick="moveBookDown(${book.id})" title="Move Down">↓</button>
                    <button class="btn-icon" onclick="openModifyModal(${book.id})" title="Modify">✎</button>
                    <button class="btn-icon-danger" onclick="deleteBook(${book.id})" title="Remove">✕</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    let totalScore = studyData.mode === 'time' ? (studyData.totalMinutes / 60) : studyData.totalMinutes;
    let maxH;
    if (studyData.mode === 'auto') {
        maxH = studyData.books.reduce((sum, book) => sum + (book.chapters || 0), 0);
    } else {
        maxH = studyData.maxHours || (studyData.mode === 'time' ? 730 : 100);
    }
    
    if (studyData.mode === 'time') {
        document.getElementById('total-hours').textContent = `${Math.floor(studyData.totalMinutes / 60)}:${Math.floor(studyData.totalMinutes % 60).toString().padStart(2, '0')}`;
    } else {
        document.getElementById('total-hours').textContent = studyData.totalMinutes;
    }
    
    document.getElementById('max-hours').textContent = maxH;
    if (studyData.mode === 'auto') {
        document.getElementById('max-hours').title = "Auto-calculated sum of all chapters";
        document.getElementById('max-hours').style.cursor = "default";
    } else {
        document.getElementById('max-hours').title = "Click to change max " + (studyData.unitLabel || "goal").toLowerCase();
        document.getElementById('max-hours').style.cursor = "pointer";
    }
    document.getElementById('unit-label-small').textContent = studyData.unitLabel || "Hours";
    document.getElementById('effort-header').textContent = `Total Effort (${studyData.unitLabel || "Hrs"})`;
    
    const progressPercent = maxH > 0 ? Math.min((totalScore / maxH) * 100, 100) : 0;
    document.getElementById('progress-bar-fill').style.width = `${progressPercent}%`;
}

function logActivity(type, bookId, value) {
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    studyData.activityLog = studyData.activityLog || [];
    studyData.activityLog.push({ date: todayLocal, type, bookId, value, timestamp: Date.now() });
}

function addMinutes(bookId, mins) {
    if (!mins || isNaN(mins)) return;
    const addedMins = parseFloat(mins);
    
    logActivity('minutes', bookId, addedMins);
    saveData();
}

function toggleChapter(bookId, ch) {
    const book = studyData.books.find(b => b.id === bookId);
    const index = book.done.indexOf(ch);
    if (index > -1) {
        const wasDone = book.done.length === book.chapters;
        book.done.splice(index, 1);
        
        studyData.activityLog = (studyData.activityLog || []).filter(l => !(l.type === 'chapter_done' && l.bookId === bookId && l.value === ch));
        if (wasDone) {
            studyData.activityLog = studyData.activityLog.filter(l => !(l.type === 'book_done' && l.bookId === bookId));
        }
    } else {
        book.done.push(ch);
        logActivity('chapter_done', bookId, ch);
        if (book.done.length === book.chapters) {
            logActivity('book_done', bookId, null);
        }
    }
    saveData();
}

function addNewBook() {
    const name = document.getElementById('new-name').value;
    const ch = parseInt(document.getElementById('new-chapters').value);
    const exp = document.getElementById('new-access-date').value;
    
    if(!name || isNaN(ch) || ch <= 0) {
        alert("Please enter a valid book title and a positive number of chapters.");
        return;
    }

    studyData.books.push({
        id: Date.now(),
        name, chapters: ch, done: [], hours: 0, expiryDate: exp
    });
    
    document.getElementById('new-name').value = '';
    document.getElementById('new-chapters').value = '';
    document.getElementById('new-access-date').value = '';

    toggleAddBook();
    saveData();
}

function deleteBook(id) {
    if(confirm("Permanently remove this book and its hours?")) {
        studyData.books = studyData.books.filter(b => b.id !== id);
        studyData.activityLog = (studyData.activityLog || []).filter(l => l.bookId !== id);
        saveData();
    }
}

function moveBookUp(id) {
    const index = studyData.books.findIndex(b => b.id === id);
    if (index > 0) {
        const temp = studyData.books[index - 1];
        studyData.books[index - 1] = studyData.books[index];
        studyData.books[index] = temp;
        saveData();
    }
}

function moveBookDown(id) {
    const index = studyData.books.findIndex(b => b.id === id);
    if (index > -1 && index < studyData.books.length - 1) {
        const temp = studyData.books[index + 1];
        studyData.books[index + 1] = studyData.books[index];
        studyData.books[index] = temp;
        saveData();
    }
}

function editMaxHours() {
    if (studyData.mode === 'auto') {
        alert("In Auto Mode, the maximum goal is automatically calculated as the sum of all book chapters.");
        return;
    }
    const currentMax = studyData.maxHours || (studyData.mode === 'time' ? 730 : 100);
    const newMax = prompt(`Enter new maximum ${studyData.unitLabel || 'goal'}:`, currentMax);
    if (newMax !== null && !isNaN(newMax) && newMax.trim() !== '') {
        studyData.maxHours = parseInt(newMax);
        saveData();
    }
}

function toggleAddBook() { 
    const form = document.getElementById('add-book-form');
    form.style.display = form.style.display === 'none' ? '' : 'none';
}

function toggleDarkMode() {
    appData.isDarkMode = !appData.isDarkMode;
    document.body.classList.toggle('dark-mode', appData.isDarkMode);
    document.getElementById('dark-mode-btn').textContent = appData.isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
    saveData();
}

function renderChart() {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;
    
    studyData.activityLog = studyData.activityLog || [];
    
    const dateMap = {};
    studyData.activityLog.forEach(log => {
        const parts = log.date.split('-');
        const shortDate = parts.length === 3 ? `${parts[1]}-${parts[2]}` : log.date;
        
        if (!dateMap[shortDate]) {
            dateMap[shortDate] = { hours: 0, milestones: [] };
        }
        if (log.type === 'minutes') {
            dateMap[shortDate].hours += (studyData.mode === 'time' ? (log.value / 60) : log.value);
        } else if (studyData.mode === 'auto' && log.type === 'chapter_done') {
            dateMap[shortDate].hours += 1;
        } else if (log.type === 'chapter_done') {
            const book = studyData.books.find(b => b.id === log.bookId);
            const bookName = book ? book.name : 'Unknown';
            dateMap[shortDate].milestones.push(`Ch ${log.value} (${bookName})`);
        } else if (log.type === 'book_done') {
            const book = studyData.books.find(b => b.id === log.bookId);
            const bookName = book ? book.name : 'Unknown';
            dateMap[shortDate].milestones.push(`Finished: ${bookName} 🏆`);
        }
    });

    const sortedDates = Object.keys(dateMap).sort();
    const dataHours = sortedDates.map(d => dateMap[d].hours);
    
    const pointStyles = sortedDates.map(d => dateMap[d].milestones.some(m => m.includes('🏆')) ? 'star' : (dateMap[d].milestones.length > 0 ? 'rectRot' : 'circle'));
    const pointRadiuses = sortedDates.map(d => dateMap[d].milestones.some(m => m.includes('🏆')) ? 10 : (dateMap[d].milestones.length > 0 ? 7 : 3));
    const pointColors = sortedDates.map(d => dateMap[d].milestones.some(m => m.includes('🏆')) ? '#FFD700' : (dateMap[d].milestones.length > 0 ? '#4CAF50' : '#2196F3'));

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates.length ? sortedDates : ['No Data'],
            datasets: [{
                label: studyData.unitLabel || 'Hours Spent',
                data: dataHours.length ? dataHours : [0],
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                borderWidth: 2,
                pointStyle: pointStyles,
                pointRadius: pointRadiuses,
                pointBackgroundColor: pointColors,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y;
                            if (studyData.mode === 'time') {
                                const h = Math.floor(val);
                                const m = Math.floor((val % 1) * 60).toString().padStart(2, '0');
                                return `${studyData.unitLabel || 'Hours'}: ${h}:${m}`;
                            } else {
                                return `${studyData.unitLabel || 'Units'}: ${val}`;
                            }
                        },
                        afterLabel: function(context) {
                            const date = context.label;
                            if (dateMap[date] && dateMap[date].milestones.length > 0) {
                                return '\nMilestones:\n' + dateMap[date].milestones.join('\n');
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: { display: isChartExpanded },
                y: { 
                    display: isChartExpanded, 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (studyData.mode === 'time') {
                                const h = Math.floor(value);
                                const m = Math.floor((value % 1) * 60).toString().padStart(2, '0');
                                return `${h}:${m}`;
                            }
                            return value;
                        }
                    }
                }
            }
        }
    });
}

function toggleChartExpand() {
    isChartExpanded = !isChartExpanded;
    const container = document.getElementById('chart-container');
    if (isChartExpanded) {
        container.style.position = 'fixed';
        container.style.top = '10%';
        container.style.left = '10%';
        container.style.width = '80%';
        container.style.height = '80%';
        container.style.zIndex = '9999';
        container.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
        container.style.padding = '20px';
    } else {
        container.style.position = 'relative';
        container.style.top = 'auto';
        container.style.left = 'auto';
        container.style.width = 'auto';
        container.style.height = '80px';
        container.style.zIndex = 'auto';
        container.style.boxShadow = 'none';
        container.style.padding = '5px';
    }
    renderChart();
}

function openModifyModal(bookId) {
    const book = studyData.books.find(b => b.id === bookId);
    if (!book) return;
    
    pendingBookEdit = JSON.parse(JSON.stringify(book));
    pendingLogsEdit = JSON.parse(JSON.stringify((studyData.activityLog || []).filter(l => l.bookId === bookId)));
    
    document.getElementById('modify-modal-title').textContent = `Modify: ${pendingBookEdit.name}`;
    
    const chapInput = document.getElementById('modify-chapters');
    chapInput.value = pendingBookEdit.chapters;
    chapInput.onchange = (e) => {
        pendingBookEdit.chapters = parseInt(e.target.value);
        pendingBookEdit.done = pendingBookEdit.done.filter(ch => ch <= pendingBookEdit.chapters);
    };
    
    const expInput = document.getElementById('modify-expiry');
    expInput.value = pendingBookEdit.expiryDate || '';
    expInput.onchange = (e) => { pendingBookEdit.expiryDate = e.target.value; };
    
    renderPendingLogs();
    
    document.getElementById('modify-modal').style.display = 'flex';
}

function cancelModify() {
    pendingBookEdit = null;
    pendingLogsEdit = null;
    document.getElementById('modify-modal').style.display = 'none';
}

function confirmModify() {
    if (!pendingBookEdit) return;
    
    const originalBookIndex = studyData.books.findIndex(b => b.id === pendingBookEdit.id);
    if (originalBookIndex > -1) {
        studyData.books[originalBookIndex] = pendingBookEdit;
        studyData.activityLog = studyData.activityLog.filter(l => l.bookId !== pendingBookEdit.id);
        studyData.activityLog.push(...pendingLogsEdit);
        
        saveData();
    }
    cancelModify();
}

function renderPendingLogs() {
    const logsContainer = document.getElementById('modify-logs-list');
    
    if (pendingLogsEdit.length === 0) {
        logsContainer.innerHTML = '<p>No logs available.</p>';
        return;
    }

    logsContainer.innerHTML = pendingLogsEdit.map(log => {
        if (log.type === 'minutes') {
            const label = studyData.mode === 'time' ? 'Minutes' : 'Value';
            return `
                <div class="log-edit-row">
                    <span>${log.date} - ${label}:</span>
                    <input type="number" value="${log.value}" onchange="editPendingLog(${log.timestamp}, 'value', this.value)" style="width: 60px;">
                    <button onclick="removePendingLog(${log.timestamp})" class="danger-text">Delete</button>
                </div>
            `;
        } else if (log.type === 'chapter_done') {
            return `
                <div class="log-edit-row">
                    <span>${log.date} - Finished Ch. ${log.value}</span>
                    <button onclick="removePendingLog(${log.timestamp})" class="danger-text">Delete</button>
                </div>
            `;
        } else if (log.type === 'book_done') {
            return `
                <div class="log-edit-row">
                    <span>${log.date} - Finished Book 🏆</span>
                    <button onclick="removePendingLog(${log.timestamp})" class="danger-text">Delete</button>
                </div>
            `;
        }
        return '';
    }).join('');
}

function editPendingLog(timestamp, field, newValue) {
    const log = pendingLogsEdit.find(l => l.timestamp === timestamp);
    if (!log) return;
    
    if (log.type === 'minutes' && field === 'value') {
        const newVal = parseFloat(newValue) || 0;
        
        log.value = newVal;
    }
    
    renderPendingLogs();
}

function removePendingLog(timestamp) {
    const logIndex = pendingLogsEdit.findIndex(l => l.timestamp === timestamp);
    if (logIndex === -1) return;
    
    const log = pendingLogsEdit[logIndex];
    
    if (log.type === 'chapter_done') {
        const chIndex = pendingBookEdit.done.indexOf(log.value);
        if (chIndex > -1) pendingBookEdit.done.splice(chIndex, 1);
    }
    
    pendingLogsEdit.splice(logIndex, 1);
    
    renderPendingLogs();
}

function renderWorkspaceDropdown() {
    const select = document.getElementById('workspace-select');
    if (!select) return;
    select.innerHTML = '';
    Object.keys(appData.workspaces).forEach(ws => {
        const opt = document.createElement('option');
        opt.value = ws;
        opt.textContent = ws;
        if (ws === appData.activeWorkspace) opt.selected = true;
        select.appendChild(opt);
    });
}

function switchWorkspace(name) {
    if (!appData.workspaces[name]) return;
    appData.activeWorkspace = name;
    studyData = appData.workspaces[name];
    saveData();
}

function createNewWorkspace() {
    document.getElementById('new-ws-name').value = '';
    document.getElementById('new-ws-mode').value = 'time';
    updateNewWorkspaceLabels();
    document.getElementById('new-workspace-modal').style.display = 'flex';
}

function closeNewWorkspaceModal() {
    document.getElementById('new-workspace-modal').style.display = 'none';
}

function updateNewWorkspaceLabels() {
    const mode = document.getElementById('new-ws-mode').value;
    const labelInput = document.getElementById('new-ws-label');
    if (mode === 'time') labelInput.value = 'Hours';
    else if (mode === 'unit') labelInput.value = 'Pages';
    else if (mode === 'auto') labelInput.value = 'Chapters';
}

function confirmNewWorkspace() {
    const name = document.getElementById('new-ws-name').value;
    const mode = document.getElementById('new-ws-mode').value;
    const label = document.getElementById('new-ws-label').value || 'Units';
    
    if (name && name.trim() !== '') {
        const cleanName = name.trim();
        if (!appData.workspaces[cleanName]) {
            appData.workspaces[cleanName] = { 
                totalMinutes: 0, books: [], maxHours: mode === 'time' ? 730 : 100, activityLog: [],
                mode: mode, unitLabel: label
            };
            appData.activeWorkspace = cleanName;
            studyData = appData.workspaces[cleanName];
            renderWorkspaceDropdown();
            saveData();
            closeNewWorkspaceModal();
        } else {
            alert("A subject with that name already exists.");
        }
    } else {
        alert("Please enter a valid name.");
    }
}

function renameCurrentWorkspace() {
    const currentName = appData.activeWorkspace;
    const newName = prompt("Enter new name for this subject:", currentName);
    if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
        const cleanName = newName.trim();
        if (!appData.workspaces[cleanName]) {
            appData.workspaces[cleanName] = appData.workspaces[currentName];
            delete appData.workspaces[currentName];
            appData.activeWorkspace = cleanName;
            studyData = appData.workspaces[cleanName];
            renderWorkspaceDropdown();
            saveData();
        } else {
            alert("A subject with that name already exists.");
        }
    }
}

function deleteCurrentWorkspace() {
    const keys = Object.keys(appData.workspaces);
    if (keys.length <= 1) {
        alert("You cannot delete your only subject. Create a new one first.");
        return;
    }
    if (confirm(`Are you sure you want to delete the subject "${appData.activeWorkspace}" and all its data?`)) {
        delete appData.workspaces[appData.activeWorkspace];
        appData.activeWorkspace = Object.keys(appData.workspaces)[0];
        studyData = appData.workspaces[appData.activeWorkspace];
        renderWorkspaceDropdown();
        saveData();
    }
}

function saveData() {
    syncTotals();
    localStorage.setItem('hourBankAppData', JSON.stringify(appData));
    renderDashboard();
    renderChart();
}

function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "hour_bank_backup.json");
    dlAnchorElem.click();
}

function exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Type,Book Name,Value\n";
    
    (studyData.activityLog || []).forEach(log => {
        const book = studyData.books.find(b => b.id === log.bookId);
        const bookName = book ? book.name : 'Unknown';
        const row = `${log.date},${log.type},"${bookName.replace(/"/g, '""')}",${log.value || ''}`;
        csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "study_log.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function openCloudSettingsModal() {
    document.getElementById('cloud-token').value = cloudConfig.token || '';
    document.getElementById('cloud-gist-id').value = cloudConfig.gistId || '';
    document.getElementById('cloud-settings-modal').style.display = 'flex';
}

function closeCloudSettingsModal() {
    document.getElementById('cloud-settings-modal').style.display = 'none';
}

function saveCloudSettings() {
    cloudConfig.token = document.getElementById('cloud-token').value.trim();
    
    let rawGistId = document.getElementById('cloud-gist-id').value.trim();
    if (rawGistId.includes('/')) {
        const parts = rawGistId.split('/').filter(p => p.trim() !== '');
        rawGistId = parts[parts.length - 1];
    }
    cloudConfig.gistId = rawGistId;
    
    localStorage.setItem('hourBankCloudConfig', JSON.stringify(cloudConfig));
    closeCloudSettingsModal();
    alert('Cloud settings saved successfully!');
}

async function syncWithCloud() {
    if (!cloudConfig.token || !cloudConfig.gistId) {
        alert("Please configure your GitHub Token and Gist ID first.");
        openCloudSettingsModal();
        return;
    }

    const syncBtn = document.getElementById('cloud-sync-btn');
    syncBtn.textContent = '☁️ Syncing...';
    syncBtn.disabled = true;

    try {
        // 1. Fetch Remote Data
        const getResponse = await fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cloudConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!getResponse.ok) throw new Error('Failed to fetch from GitHub');

        const gistData = await getResponse.json();
        const fileName = Object.keys(gistData.files)[0]; // Use the first file in the Gist
        const remoteAppData = JSON.parse(gistData.files[fileName].content);

        // 2. Merge Data safely
        if (remoteAppData && remoteAppData.workspaces) {
            mergeCloudData(remoteAppData);
            studyData = appData.workspaces[appData.activeWorkspace];
            saveData(); // Save locally and re-render the dashboard
        }

        // 3. Push Merged Data Back
        const patchData = {
            files: {
                [fileName]: { content: JSON.stringify(appData, null, 2) }
            }
        };

        const patchResponse = await fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${cloudConfig.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(patchData)
        });

        if (!patchResponse.ok) throw new Error('Failed to update GitHub Gist');

        syncBtn.textContent = '☁️ Sync Complete!';
        setTimeout(() => { syncBtn.textContent = '☁️ Cloud Sync'; syncBtn.disabled = false; }, 2000);

    } catch (error) {
        console.error(error);
        alert('Cloud Sync Failed: ' + error.message);
        syncBtn.textContent = '☁️ Cloud Sync';
        syncBtn.disabled = false;
    }
}

function mergeCloudData(remoteData) {
    if (!remoteData || !remoteData.workspaces) return;
    
    Object.keys(remoteData.workspaces).forEach(wsName => {
        if (!appData.workspaces[wsName]) {
            appData.workspaces[wsName] = remoteData.workspaces[wsName];
        } else {
            let localWs = appData.workspaces[wsName];
            let remoteWs = remoteData.workspaces[wsName];

            // Safely merge activity logs using their unique timestamps
            let allLogsMap = new Map();
            (localWs.activityLog || []).forEach(l => allLogsMap.set(l.timestamp, l));
            (remoteWs.activityLog || []).forEach(l => allLogsMap.set(l.timestamp, l));
            localWs.activityLog = Array.from(allLogsMap.values()).sort((a,b) => a.timestamp - b.timestamp);

            // Combine books to keep highest numbers (chapters done, limits, etc.)
            let allBooksMap = new Map();
            (remoteWs.books || []).forEach(b => allBooksMap.set(b.id, JSON.parse(JSON.stringify(b))));
            (localWs.books || []).forEach(b => {
                if (allBooksMap.has(b.id)) {
                    let remoteBook = allBooksMap.get(b.id);
                    b.done = Array.from(new Set([...(b.done || []), ...(remoteBook.done || [])]));
                    b.chapters = Math.max(b.chapters || 0, remoteBook.chapters || 0);
                }
                allBooksMap.set(b.id, b);
            });
            localWs.books = Array.from(allBooksMap.values());
            
            localWs.maxHours = Math.max(localWs.maxHours || 0, remoteWs.maxHours || 0);
        }
    });

    if (!appData.workspaces[appData.activeWorkspace]) {
        appData.activeWorkspace = Object.keys(appData.workspaces)[0];
    }
    renderWorkspaceDropdown();
}

function loadBackup(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const imported = JSON.parse(e.target.result);
        if (imported.workspaces) {
            appData = imported;
            Object.values(appData.workspaces).forEach(ws => {
                if (!ws.mode) ws.mode = 'time';
                if (!ws.unitLabel) ws.unitLabel = 'Hours';
            });
        } else {
            appData.workspaces["Imported Subject"] = {
                totalMinutes: imported.totalMinutes || 0,
                books: imported.books || [],
                maxHours: imported.maxHours || 730,
                activityLog: imported.activityLog || [],
                mode: 'time',
                unitLabel: 'Hours'
            };
            appData.activeWorkspace = "Imported Subject";
            if (imported.isDarkMode !== undefined) appData.isDarkMode = imported.isDarkMode;
        }
        studyData = appData.workspaces[appData.activeWorkspace];
        renderWorkspaceDropdown();
        
        document.body.classList.toggle('dark-mode', appData.isDarkMode);
        document.getElementById('dark-mode-btn').textContent = appData.isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
        
        saveData();
    };
    reader.readAsText(event.target.files[0]);
}

function openAboutModal() {
    document.getElementById('about-modal').style.display = 'flex';
}

function closeAboutModal() {
    document.getElementById('about-modal').style.display = 'none';
}

init();