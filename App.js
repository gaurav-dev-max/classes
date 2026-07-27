// Initialize Supabase Client
const SUPABASE_URL = 'https://hizlhtxaypzgnizmjnqm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpemxodHhheXB6Z25pem1qbnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTY5NzksImV4cCI6MjEwMDczMjk3OX0.HH9NaWUl5HSgzoy4w6W_57ylMRsIZS41LtGp7wM7V00';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Management
let currentUser = null;
let currentRole = 'student';

// PWA Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// Global Initialization
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await fetchUserProfile();
    navigate('dashboard');
  } else {
    renderAuthScreen();
  }
});

async function fetchUserProfile() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', currentUser.id)
    .single();

  if (data) {
    currentRole = data.role;
    document.getElementById('user-profile-badge').innerText = `${data.full_name} (${data.role.toUpperCase()})`;
  }
}

// Router Function
function navigate(view) {
  const root = document.getElementById('app-root');
  if (!currentUser && view !== 'auth') {
    renderAuthScreen();
    return;
  }

  if (view === 'dashboard') renderDashboard(root);
  if (view === 'courses') renderCourses(root);
  if (view === 'tests') renderTests(root);
  if (view === 'profile') renderProfile(root);
}

// Authentication Screen
function renderAuthScreen() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <div class="card" style="margin-top: 40px;">
      <h2 style="margin-bottom:16px;">Welcome to LMS Pro</h2>
      <input type="email" id="auth-email" placeholder="Email Address">
      <input type="password" id="auth-password" placeholder="Password">
      <button class="btn" onclick="handleLogin()">Login</button>
      <button class="btn" style="background:transparent; border:1px solid var(--border-light); margin-top:8px;" onclick="handleSignUp()">Create Account</button>
    </div>
  `;
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) alert(error.message);
  else {
    currentUser = data.user;
    await fetchUserProfile();
    navigate('dashboard');
  }
}

async function handleSignUp() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const { data, error } = await supabase.auth.signUp({ email, password });
  
  if (error) alert(error.message);
  else {
    alert("Account created! Set up your profile now.");
    if (data.user) {
      await supabase.from('profiles').insert([
        { id: data.user.id, full_name: email.split('@')[0], role: 'student' }
      ]);
      currentUser = data.user;
      await fetchUserProfile();
      navigate('dashboard');
    }
  }
}

// Dashboard View
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="card">
      <h3>🚀 Quick Overview</h3>
      <p style="color:var(--text-sub); margin-top:8px;">Access your active lectures, study materials, and tests right from here.</p>
    </div>
    
    ${currentRole === 'admin' ? `
      <div class="card" style="border-color: var(--accent);">
        <h3>👑 Admin Actions</h3>
        <button class="btn" style="margin-top:12px;" onclick="showAddCourseModal()">+ Add New Course</button>
      </div>
    ` : ''}

    <h3 style="margin: 16px 0 8px 0;">Your Enrolled Content</h3>
    <div id="dashboard-courses-list">Loading courses...</div>
  `;
  loadCoursesList('dashboard-courses-list');
}

// Courses Loader View
async function loadCoursesList(targetId) {
  const target = document.getElementById(targetId);
  const { data: courses, error } = await supabase.from('courses').select('*');

  if (error || !courses || courses.length === 0) {
    target.innerHTML = `<p style="color:var(--text-sub);">No courses available yet.</p>`;
    return;
  }

  target.innerHTML = courses.map(course => `
    <div class="card" onclick="openCourseDetails('${course.id}')">
      <h3>${course.title}</h3>
      <p style="color:var(--text-sub); font-size:0.9rem; margin-top:4px;">${course.description || 'No description provided'}</p>
    </div>
  `).join('');
}

// Open Course Details View
async function openCourseDetails(courseId) {
  const root = document.getElementById('app-root');
  root.innerHTML = `<div class="card">Loading course content...</div>`;

  const { data: lectures } = await supabase.from('lectures').select('*').eq('course_id', courseId);
  const { data: materials } = await supabase.from('study_materials').select('*').eq('course_id', courseId);

  root.innerHTML = `
    <button class="btn" style="width:auto; padding:6px 12px; margin-bottom:12px;" onclick="navigate('dashboard')">← Back</button>
    
    <div class="nav-tabs">
      <button class="tab-btn active" onclick="switchCourseTab('lectures-tab')">🎥 Lectures (${lectures ? lectures.length : 0})</button>
      <button class="tab-btn" onclick="switchCourseTab('materials-tab')">📄 Materials (${materials ? materials.length : 0})</button>
    </div>

    <div id="lectures-tab" class="course-tab-content">
      ${(lectures && lectures.length) ? lectures.map(l => `
        <div class="card">
          <h4>${l.title}</h4>
          <p style="color:var(--text-sub); font-size:0.85rem; margin-bottom:8px;">${l.duration || ''}</p>
          <div class="video-wrapper">
            <iframe src="${formatEmbedUrl(l.video_url)}" frameborder="0" allowfullscreen></iframe>
          </div>
          <button class="btn" style="padding:8px;" onclick="markProgress('lecture', '${l.id}', '${courseId}')">Mark as Completed</button>
        </div>
      `).join('') : '<p style="color:var(--text-sub);">No lectures uploaded yet.</p>'}
    </div>

    <div id="materials-tab" class="course-tab-content" style="display:none;">
      ${(materials && materials.length) ? materials.map(m => `
        <div class="card">
          <h4>${m.title}</h4>
          <p style="color:var(--text-sub); font-size:0.85rem; margin-bottom:8px;">${m.description || ''}</p>
          <a href="${m.file_url}" target="_blank" class="btn" style="text-decoration:none; text-align:center;" onclick="markProgress('material', '${m.id}', '${courseId}')">Open Document 📄</a>
        </div>
      `).join('') : '<p style="color:var(--text-sub);">No materials uploaded yet.</p>'}
    </div>
  `;
}

function formatEmbedUrl(url) {
  if (url.includes('youtube.com/watch?v=')) {
    return url.replace('watch?v=', 'embed/');
  }
  return url;
}

function switchCourseTab(tabId) {
  document.querySelectorAll('.course-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).style.display = 'block';
  event.target.classList.add('active');
}

async function markProgress(type, itemId, courseId) {
  const { error } = await supabase.from('student_progress').insert([
    { student_id: currentUser.id, item_type: type, item_id: itemId, course_id: courseId }
  ]);
  if (error) {
    if (error.code === '23505') alert('Already completed!');
    else alert(error.message);
  } else {
    alert('Progress saved successfully!');
  }
}

// Admin Modal Logic
function showAddCourseModal() {
  const title = prompt("Enter Course Title:");
  const description = prompt("Enter Course Description:");
  if (title) {
    supabase.from('courses').insert([{ title, description }]).then(({ error }) => {
      if (error) alert(error.message);
      else navigate('dashboard');
    });
  }
}

// User Profile View
async function renderProfile(container) {
  const { count } = await supabase
    .from('student_progress')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', currentUser.id);

  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <div style="font-size:3rem; margin-bottom:8px;">👤</div>
      <h3>${currentUser.email}</h3>
      <p style="color:var(--text-sub); margin-top:4px;">Role: ${currentRole.toUpperCase()}</p>
    </div>

    <div class="card">
      <h4>📊 Academic Progress Summary</h4>
      <p style="color:var(--text-sub); margin-top:8px;">Completed Items: <strong>${count || 0}</strong></p>
    </div>

    <button class="btn" style="background:#ef4444;" onclick="handleLogout()">Logout</button>
  `;
}

async function handleLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  renderAuthScreen();
}

