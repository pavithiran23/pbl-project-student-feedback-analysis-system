// --- State Management ---
let currentUser = null;
let isLoginMode = true; // Toggle between login and register

// --- DOM Elements ---
const views = {
    auth: document.getElementById('auth-view'),
    student: document.getElementById('student-view'),
    admin: document.getElementById('admin-view')
};
const header = document.getElementById('main-header');

// --- Initialization ---
function init() {
    const storedUser = localStorage.getItem('eduFeedbackUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        updateUIForUser();
    } else {
        showView('auth');
    }
}

// --- Navigation / Routing ---
function showView(viewName) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    Object.values(views).forEach(el => el.classList.add('hidden'));
    
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active');

    if (viewName === 'auth') {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
        document.getElementById('nav-user-name').textContent = `${currentUser.name} (${currentUser.role})`;
    }
}

// --- Auth Logic ---
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').textContent = isLoginMode ? 'Student Portal' : 'Register New Account';
    document.getElementById('auth-btn').textContent = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('auth-name').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('toggle-msg').textContent = isLoginMode ? 'New here?' : 'Already have an account?';
    document.getElementById('toggle-auth').textContent = isLoginMode ? 'Create Account' : 'Login';
    document.getElementById('auth-role').style.display = isLoginMode ? 'none' : 'block';
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    const payload = isLoginMode ? { email, password } : {
        name: document.getElementById('auth-name').value,
        email,
        password,
        role: document.getElementById('auth-role').value
    };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        if (isLoginMode) {
            currentUser = data;
            localStorage.setItem('eduFeedbackUser', JSON.stringify(currentUser));
            updateUIForUser();
            showToast('Welcome back!');
        } else {
            toggleAuthMode(); // Switch to login after register
            showToast('Registration successful! Please login.');
        }
    } catch (err) {
        showToast(err.message, true);
    }
});

function updateUIForUser() {
    if (currentUser.role === 'admin') {
        showView('admin');
        loadAdminData();
    } else {
        showView('student');
        loadStudentHistory();
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('eduFeedbackUser');
    showView('auth');
    showToast('Logged out successfully');
}

// --- Student Logic ---
document.getElementById('feedback-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('fb-category').value;
    const rating = document.querySelector('input[name="rating"]:checked').value;
    const comments = document.getElementById('fb-comments').value;

    try {
        const res = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, category, rating, comments })
        });
        if (res.ok) {
            showToast('Feedback submitted!');
            document.getElementById('feedback-form').reset();
            loadStudentHistory();
        }
    } catch (err) { showToast('Error submitting feedback', true); }
});

async function loadStudentHistory() {
    const res = await fetch(`/api/feedback/history/${currentUser.id}`);
    const feedbacks = await res.json();
    const container = document.getElementById('student-history-list');
    container.innerHTML = '';
    
    feedbacks.forEach(fb => {
        const div = document.createElement('div');
        div.className = 'feedback-item';
        div.innerHTML = `
            <div class="feedback-header">
                <span>${fb.category}</span>
                <span>${new Date(fb.created_at).toLocaleDateString()}</span>
            </div>
            <div style="color: #fbbf24; margin-bottom: 5px;">${'★'.repeat(fb.rating)}${'☆'.repeat(5-fb.rating)}</div>
            <p>${fb.comments}</p>
        `;
        container.appendChild(div);
    });
}

// --- Admin Logic ---
function switchAdminTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`admin-${tab}-tab`).classList.remove('hidden');
    event.target.classList.add('active');
}

async function loadAdminData() {
    // Load Feedback
    const fbRes = await fetch('/api/admin/feedback');
    const feedbacks = await fbRes.json();
    const fbContainer = document.getElementById('admin-feedback-list');
    
    let fbHtml = `<table><thead><tr><th>Date</th><th>Student</th><th>Category</th><th>Rating</th><th>Comments</th><th>Action</th></tr></thead><tbody>`;
    feedbacks.forEach(fb => {
        fbHtml += `
            <tr>
                <td>${new Date(fb.created_at).toLocaleDateString()}</td>
                <td>${fb.student_name}</td>
                <td>${fb.category}</td>
                <td>${fb.rating}/5</td>
                <td>${fb.comments.substring(0, 30)}...</td>
                <td><button class="btn-sm btn-delete" onclick="deleteFeedback(${fb.id})">Delete</button></td>
            </tr>
        `;
    });
    fbHtml += `</tbody></table>`;
    fbContainer.innerHTML = fbHtml;

    // Load Users
    const userRes = await fetch('/api/admin/users');
    const users = await userRes.json();
    const userContainer = document.getElementById('admin-users-list');

    let userHtml = `<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead><tbody>`;
    users.forEach(user => {
        // Cannot delete self or if logic prevents last admin
        const isSelf = user.id === currentUser.id;
        userHtml += `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td><span style="color: ${user.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)'}">${user.role}</span></td>
                <td>
                    ${!isSelf ? `<button class="btn-sm btn-delete" onclick="deleteUser(${user.id})">Remove</button>` : '<span style="font-size:0.8rem; color:gray;">Current</span>'}
                </td>
            </tr>
        `;
    });
    userHtml += `</tbody></table>`;
    userContainer.innerHTML = userHtml;
}

async function deleteFeedback(id) {
    if(!confirm("Are you sure?")) return;
    await fetch(`/api/admin/feedback/${id}`, { method: 'DELETE' });
    loadAdminData();
    showToast('Feedback deleted');
}

async function deleteUser(id) {
    if(!confirm("Remove this user? Their feedback will also be deleted.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    
    if (res.ok) {
        loadAdminData();
        showToast('User removed');
    } else {
        showToast(data.error, true);
    }
}

// --- Utilities ---
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = isError ? 'var(--danger)' : 'var(--secondary)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Start
init();