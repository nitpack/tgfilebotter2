// admin-panel.js - Admin Panel Client-Side Logic (FIXED VERSION)

const API_BASE = window.location.origin;
let sessionToken = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupEventListeners();
});

function setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    
    // FIXED: Changed 'submit' to 'click' for logout button
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateToPage(page);
        });
    });
    
    // Bot status filter
    document.getElementById('botStatusFilter')?.addEventListener('change', loadBots);
    
    // Forms
    document.getElementById('messageForm')?.addEventListener('submit', handleSendMessage);
    document.getElementById('adminConfigForm')?.addEventListener('submit', handleSaveAdminConfig);
    document.getElementById('systemConfigForm')?.addEventListener('submit', handleSaveSystemConfig);
    document.getElementById('createBackupBtn')?.addEventListener('click', handleCreateBackup);
}

// Session Management
function checkSession() {
    sessionToken = localStorage.getItem('adminToken');
    
    if (sessionToken) {
        fetch(`${API_BASE}/api/admin/verify`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        })
        .then(res => {
            if (res.ok) {
                showDashboard();
            } else {
                localStorage.removeItem('adminToken');
                showLogin();
            }
        })
        .catch(() => {
            localStorage.removeItem('adminToken');
            showLogin();
        });
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    loadDashboardData();
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            sessionToken = data.token;
            localStorage.setItem('adminToken', sessionToken);
            errorDiv.classList.add('hidden');
            showDashboard();
        } else {
            errorDiv.textContent = data.error || 'Invalid credentials';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Login failed. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

function handleLogout() {
    localStorage.removeItem('adminToken');
    sessionToken = null;
    showLogin();
}

// Navigation
function navigateToPage(page) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
    
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.classList.add('hidden');
    });
    
    // Show selected page
    const pageMap = {
        'overview': 'overviewPage',
        'bots': 'botsPage',
        'users': 'usersPage',
        'messaging': 'messagingPage',
        'settings': 'settingsPage',
        'security': 'securityPage',
        'backups': 'backupsPage'
    };
    
    const pageId = pageMap[page];
    if (pageId) {
        document.getElementById(pageId).classList.remove('hidden');
        
        switch(page) {
            case 'overview': loadOverview(); break;
            case 'bots': loadBots(); break;
            case 'users': loadBannedUsers(); break;
            case 'messaging': loadBotsForMessaging(); break;
            case 'settings': loadSettings(); break;
            case 'security': loadSecurityLog(); break;
            case 'backups': loadBackupHistory(); break;
        }
    }
}

// Dashboard Data Loading
async function loadDashboardData() {
    loadOverview();
}

async function loadOverview() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/stats`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statTotalBots').textContent = data.stats.total || 0;
            document.getElementById('statApproved').textContent = data.stats.approved || 0;
            document.getElementById('statPending').textContent = data.stats.pending || 0;
            document.getElementById('statBanned').textContent = data.stats.bannedUsers || 0;
            
            loadRecentActivity();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadRecentActivity() {
    const activityDiv = document.getElementById('recentActivity');
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/activity`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.activity.length > 0) {
            activityDiv.innerHTML = data.activity.map(item => `
                <div class="log-entry ${item.severity || 'low'}">
                    <div class="log-time">${new Date(item.timestamp).toLocaleString()}</div>
                    <div class="log-message">${escapeHtml(item.message)}</div>
                </div>
            `).join('');
        } else {
            activityDiv.innerHTML = '<p class="text-center">No recent activity</p>';
        }
    } catch (error) {
        activityDiv.innerHTML = '<p class="text-center">Error loading activity</p>';
    }
}

// Bot Management
async function loadBots() {
    const tbody = document.getElementById('botsTableBody');
    const filter = document.getElementById('botStatusFilter')?.value || 'all';
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner"></div></td></tr>';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/bots?status=${filter}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.bots.length > 0) {
            tbody.innerHTML = data.bots.map(bot => `
                <tr>
                    <td>${escapeHtml(bot.botUsername)}</td>
                    <td><span class="badge badge-${getBadgeClass(bot.status)}">${bot.status}</span></td>
                    <td>${bot.ownerId || 'Not registered'}</td>
                    <td>${new Date(bot.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            ${bot.status === 'pending' ? `
                                <button class="btn btn-success btn-sm" onclick="approveBot('${bot.id}')">Approve</button>
                            ` : ''}
                            ${bot.status === 'approved' ? `
                                <button class="btn btn-warning btn-sm" onclick="disconnectBot('${bot.id}')">Disconnect</button>
                            ` : ''}
                            ${bot.ownerId ? `
                                <button class="btn btn-danger btn-sm" onclick="banOwner('${bot.ownerId}')">Ban Owner</button>
                            ` : ''}
                            <button class="btn btn-sm" onclick="viewBotDetails('${bot.id}')">Details</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No bots found</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading bots</td></tr>';
    }
}

function getBadgeClass(status) {
    const map = {
        'approved': 'success',
        'pending': 'warning',
        'disconnected': 'danger',
        'banned': 'danger'
    };
    return map[status] || 'gray';
}

async function approveBot(botId) {
    if (!confirm('Approve this bot? It will become public.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/approve-bot`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ botId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('success', 'Bot approved successfully!');
            loadBots();
        } else {
            showAlert('danger', data.error || 'Failed to approve bot');
        }
    } catch (error) {
        showAlert('danger', 'Error approving bot');
    }
}

async function disconnectBot(botId) {
    if (!confirm('Disconnect this bot? It will stop responding to users.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/disconnect-bot`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ botId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('success', 'Bot disconnected successfully!');
            loadBots();
        } else {
            showAlert('danger', data.error || 'Failed to disconnect bot');
        }
    } catch (error) {
        showAlert('danger', 'Error disconnecting bot');
    }
}

async function banOwner(ownerId) {
    const reason = prompt('Reason for banning this user?');
    if (!reason) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/ban-user`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: ownerId, reason })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('success', 'User banned. All their bots have been disconnected.');
            loadBots();
        } else {
            showAlert('danger', data.error || 'Failed to ban user');
        }
    } catch (error) {
        showAlert('danger', 'Error banning user');
    }
}

async function viewBotDetails(botId) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/bot/${botId}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const bot = data.bot;
            document.getElementById('botDetailsContent').innerHTML = `
                <div class="form-group">
                    <strong>Bot Username:</strong> ${escapeHtml(bot.botUsername)}
                </div>
                <div class="form-group">
                    <strong>Status:</strong> <span class="badge badge-${getBadgeClass(bot.status)}">${bot.status}</span>
                </div>
                <div class="form-group">
                    <strong>Owner ID:</strong> ${bot.ownerId || 'Not registered'}
                </div>
                <div class="form-group">
                    <strong>Channel ID:</strong> ${escapeHtml(bot.channelId)}
                </div>
                <div class="form-group">
                    <strong>Created:</strong> ${new Date(bot.createdAt).toLocaleString()}
                </div>
                <div class="form-group">
                    <strong>Total Files:</strong> ${countFiles(bot.metadata)}
                </div>
                <div class="form-group">
                    <strong>Total Folders:</strong> ${countFolders(bot.metadata)}
                </div>
            `;
            
            document.getElementById('botDetailsModal').classList.add('active');
        }
    } catch (error) {
        showAlert('danger', 'Error loading bot details');
    }
}

function countFiles(metadata) {
    if (!metadata) return 0;
    let count = (metadata.files || []).length;
    if (metadata.subfolders) {
        for (const subfolder of Object.values(metadata.subfolders)) {
            count += countFiles(subfolder);
        }
    }
    return count;
}

function countFolders(metadata) {
    if (!metadata) return 0;
    let count = Object.keys(metadata.subfolders || {}).length;
    if (metadata.subfolders) {
        for (const subfolder of Object.values(metadata.subfolders)) {
            count += countFolders(subfolder);
        }
    }
    return count;
}

// User Management
async function loadBannedUsers() {
    const container = document.getElementById('bannedUsersList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/banned-users`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.users.length > 0) {
            container.innerHTML = data.users.map(user => `
                <div class="log-entry danger">
                    <strong>User ID:</strong> ${user.userId}<br>
                    <strong>Reason:</strong> ${escapeHtml(user.reason)}<br>
                    <strong>Banned:</strong> ${new Date(user.bannedAt).toLocaleString()}<br>
                    <button class="btn btn-success btn-sm mt-1" onclick="unbanUser('${user.userId}')">Unban</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="text-center">No banned users</p>';
        }
    } catch (error) {
        container.innerHTML = '<p class="text-center">Error loading banned users</p>';
    }
}

async function unbanUser(userId) {
    if (!confirm('Unban this user? They will be able to create bots again.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/unban-user`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('success', 'User unbanned successfully');
            loadBannedUsers();
        } else {
            showAlert('danger', data.error || 'Failed to unban user');
        }
    } catch (error) {
        showAlert('danger', 'Error unbanning user');
    }
}

// Messaging
async function loadBotsForMessaging() {
    const select = document.getElementById('messageBotSelect');
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/bots?status=all`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            select.innerHTML = '<option value="">Select a bot...</option>' +
                data.bots
                    .filter(bot => bot.ownerId)
                    .map(bot => `<option value="${bot.id}">${escapeHtml(bot.botUsername)} (Owner: ${bot.ownerId})</option>`)
                    .join('');
        }
    } catch (error) {
        console.error('Error loading bots:', error);
    }
}

async function handleSendMessage(e) {
    e.preventDefault();
    
    const botId = document.getElementById('messageBotSelect').value;
    const message = document.getElementById('messageText').value;
    
    if (!botId || !message) {
        showAlert('danger', 'Please select a bot and enter a message');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/send-message`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ botId, message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('success', 'Message sent successfully!');
            document.getElementById('messageText').value = '';
        } else {
            showAlert('danger', data.error || 'Failed to send message');
        }
    } catch (error) {
        showAlert('danger', 'Error sending message');
    }
}

// Settings
async function loadSettings() {
    try {
        const adminRes = await fetch(`${API_BASE}/api/admin/config/admin`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const adminData = await adminRes.json();
        
        if (adminData.success) {
            document.getElementById('adminUserId').value = adminData.config.telegramUserId || '';
            document.getElementById('adminBotToken').value = adminData.config.botToken || '';
            document.getElementById('adminChannelId').value = adminData.config.channelId || '';
        }
        
        const systemRes = await fetch(`${API_BASE}/api/admin/config/system`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const systemData = await systemRes.json();
        
        if (systemData.success) {
            document.getElementById('maxJsonSize').value = systemData.config.maxJsonSizeMB || 10;
            document.getElementById('welcomeMessage').value = systemData.config.welcomeMessage || '';
            document.getElementById('invalidInputMessage').value = systemData.config.invalidInputMessage || '';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function handleSaveAdminConfig(e) {
    e.preventDefault();
    
    const config = {
        telegramUserId: parseInt(document.getElementById('adminUserId').value),
        botToken: document.getElementById('adminBotToken').value,
        channelId: document.getElementById('adminChannelId').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/config/admin`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('success', 'Admin configuration saved successfully!');
        } else {
            showAlert('danger', data.error || 'Failed to save configuration');
        }
    } catch (error) {
        showAlert('danger', 'Error saving configuration');
    }
}

async function handleSaveSystemConfig(e) {
    e.preventDefault();
    
    const config = {
        maxJsonSizeMB: parseInt(document.getElementById('maxJsonSize').value),
        welcomeMessage: document.getElementById('welcomeMessage').value,
        invalidInputMessage: document.getElementById('invalidInputMessage').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/config/system`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('success', 'System configuration saved successfully!');
        } else {
            showAlert('danger', data.error || 'Failed to save configuration');
        }
    } catch (error) {
        showAlert('danger', 'Error saving configuration');
    }
}

// Security
async function loadSecurityLog() {
    const logDiv = document.getElementById('securityLog');
    logDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/security-log`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.events.length > 0) {
            logDiv.innerHTML = data.events.map(event => `
                <div class="log-entry ${event.severity}">
                    <div class="log-time">${new Date(event.timestamp).toLocaleString()}</div>
                    <div class="log-message"><strong>${escapeHtml(event.type)}:</strong> ${escapeHtml(event.message)}</div>
                </div>
            `).join('');
        } else {
            logDiv.innerHTML = '<p class="text-center">No security events</p>';
        }
    } catch (error) {
        logDiv.innerHTML = '<p class="text-center">Error loading security log</p>';
    }
}

// Backups
async function handleCreateBackup() {
    const resultDiv = document.getElementById('backupResult');
    resultDiv.innerHTML = '<div class="alert alert-warning">Creating backup...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/create-backup`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    Backup created successfully!<br>
                    Location: ${escapeHtml(data.backupDir)}<br>
                    Bots backed up: ${data.manifest.botCount}
                </div>
            `;
            loadBackupHistory();
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger">Backup failed: ${escapeHtml(data.error)}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = '<div class="alert alert-danger">Error creating backup</div>';
    }
}

async function loadBackupHistory() {
    const container = document.getElementById('backupHistory');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/backups`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.backups.length > 0) {
            container.innerHTML = data.backups.map(backup => `
                <div class="log-entry">
                    <strong>Date:</strong> ${new Date(backup.timestamp).toLocaleString()}<br>
                    <strong>Bots:</strong> ${backup.botCount}<br>
                    <strong>Checksum:</strong> <code>${backup.checksum ? backup.checksum.substring(0, 16) + '...' : 'N/A'}</code>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="text-center">No backups found</p>';
        }
    } catch (error) {
        container.innerHTML = '<p class="text-center">Error loading backup history</p>';
    }
}

// Utility Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}
