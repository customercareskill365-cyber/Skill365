// Skill 365 LMS – Operational Multi-Page Client (API-connected with offline fallback)

const DEMO_ACCOUNTS = {
    student: { email: 'student@skill365.io', password: 'Skill365@2026' },
    instructor: { email: 'instructor@skill365.io', password: 'Skill365@2026' },
    admin: { email: 'admin@skill365.io', password: 'Skill365@2026' }
};

const defaultState = {
    apiConnected: false,
    token: null,
    currentUser: null,
    activeRole: 'student',
    activeCategory: 'all',
    enrolledIds: [1, 3],
    purchasedProductIds: [1],
    registeredLiveIds: [1],
    courses: [
        {
            id: 1,
            title: 'Full-Stack Web Architecture',
            category: 'Development',
            instructor: 'Rohan Mehta',
            duration: '6h 40m',
            lessons: 18,
            progress: 68,
            videoUrl: '',
            description: 'Design scalable REST APIs, authentication flows, and modern responsive UIs from scratch.'
        },
        {
            id: 2,
            title: 'UI/UX Design Systems with CSS',
            category: 'Design',
            instructor: 'Ananya Verma',
            duration: '4h 15m',
            lessons: 12,
            progress: 0,
            videoUrl: '',
            description: 'Build cohesive component libraries, color tokens, and accessible responsive layouts.'
        },
        {
            id: 3,
            title: 'Applied AI & Prompt Engineering',
            category: 'Data & AI',
            instructor: 'Dr. Kabir Nair',
            duration: '5h 20m',
            lessons: 14,
            progress: 45,
            videoUrl: '',
            description: 'Integrate LLM workflows, structured outputs, and evaluation pipelines into real apps.'
        }
    ],
    liveSessions: [
        {
            id: 1,
            title: 'Live Q&A: Scaling Node.js & PostgreSQL',
            host: 'Rohan Mehta',
            date: 'Nov 28, 2026 • 7:00 PM IST',
            status: 'upcoming',
            duration: '60 mins',
            videoUrl: '',
            description: 'Interactive architecture review and live debugging session.'
        },
        {
            id: 2,
            title: 'Workshop Recording: Design Tokens in Action',
            host: 'Ananya Verma',
            date: 'Recorded Nov 18, 2026',
            status: 'recorded',
            duration: '52:10',
            videoUrl: '',
            description: 'Full replay of our hands-on design systems workshop with Q&A.'
        }
    ],
    products: [
        {
            id: 1,
            title: 'Skill 365 Web Dev Starter Kit',
            type: 'Code Template',
            price: 499,
            description: 'Production-ready HTML/CSS/JS + Express boilerplate with auth & clean tokens.'
        },
        {
            id: 2,
            title: 'Modern UI/UX Playbook (PDF)',
            type: 'E-Book',
            price: 299,
            description: '120-page illustrated guide to spacing, typography, and design systems.'
        }
    ],
    newsletters: [
        {
            id: 1,
            title: 'Issue #42: Designing High-Trust Learning Experiences',
            date: 'Nov 20, 2026',
            summary: 'How structured video chapters and milestone certificates boost course completion.',
            body: 'In this week’s issue, we break down the pillars of engaging online courses.'
        }
    ],
    usersList: [
        { name: 'Aarav Sharma', email: 'student@skill365.io', role: 'student', status: 'Active' },
        { name: 'Rohan Mehta', email: 'instructor@skill365.io', role: 'instructor', status: 'Active' },
        { name: 'Priya Nair', email: 'admin@skill365.io', role: 'admin', status: 'Active' }
    ],
    activeCheckoutProduct: null,
    activeVideoCourseId: null
};

function loadState() {
    try {
        const saved = localStorage.getItem('skill365_state_v3');
        if (saved) return { ...defaultState, ...JSON.parse(saved) };
    } catch (e) {}
    return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
    try {
        localStorage.setItem('skill365_state_v3', JSON.stringify(state));
    } catch (e) {}
}

let state = loadState();

async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

async function initBackendSync() {
    if (!window.location.protocol.startsWith('http')) return;
    try {
        await apiFetch('/api/health');
        state.apiConnected = true;

        const [courses, liveSessions, products, newsletters] = await Promise.all([
            apiFetch('/api/courses'),
            apiFetch('/api/live-sessions'),
            apiFetch('/api/products'),
            apiFetch('/api/newsletters')
        ]);
        state.courses = courses;
        state.liveSessions = liveSessions;
        state.products = products;
        state.newsletters = newsletters;

        if (!state.token) {
            await loginDemoRole(state.activeRole, true);
        } else {
            try {
                const me = await apiFetch('/api/auth/me');
                applyUserToState(me.user);
            } catch (e) {
                await loginDemoRole(state.activeRole, true);
            }
        }
        saveState();
        renderAll();
    } catch (e) {
        state.apiConnected = false;
    }
}

function applyUserToState(user) {
    state.currentUser = user;
    state.activeRole = user.role;
    state.enrolledIds = user.enrolledIds || [];
    state.purchasedProductIds = user.purchasedProductIds || [];
    state.registeredLiveIds = user.registeredLiveIds || [];
    if (user.progress) {
        state.courses.forEach(c => {
            if (user.progress[c.id] !== undefined) c.progress = user.progress[c.id];
        });
    }
}

async function loginDemoRole(role, silent = false) {
    const creds = DEMO_ACCOUNTS[role];
    if (!creds) return;
    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(creds)
    });
    state.token = data.token;
    applyUserToState(data.user);
    if (role === 'admin') {
        try {
            state.usersList = await apiFetch('/api/admin/users');
        } catch (e) {}
    }
    saveState();
    if (!silent) showToast(`Signed in as ${data.user.name} (${role})`);
}

function renderAll() {
    renderHomeFeatured();
    renderCourses();
    renderLiveSessions();
    renderStore();
    renderNewsletters();
    renderProfile();
}

document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.querySelector('.nav ul');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => navMenu.classList.toggle('show'));
    }

    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) {
        roleSelect.value = state.activeRole;
        roleSelect.addEventListener('change', (e) => setRole(e.target.value));
    }

    document.querySelectorAll('#courseFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#courseFilters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeCategory = btn.dataset.category;
            renderCourses();
        });
    });

    document.querySelectorAll('#profileRoleTabs .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => setRole(btn.dataset.role));
    });

    const nlForm = document.getElementById('newsletterForm');
    if (nlForm) {
        nlForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('newsletterEmail').value.trim();
            if (!email) return;
            if (state.apiConnected) {
                try {
                    await apiFetch('/api/newsletters/subscribe', {
                        method: 'POST',
                        body: JSON.stringify({ email })
                    });
                } catch (err) {}
            }
            const fb = document.getElementById('newsletterFeedback');
            if (fb) fb.textContent = `Subscribed ${email} to the Skill 365 Weekly Digest!`;
            e.target.reset();
            showToast('Subscribed to Skill 365 Newsletter');
        });
    }

    renderAll();
    initBackendSync();
});

async function setRole(role) {
    state.activeRole = role;
    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) roleSelect.value = role;

    if (state.apiConnected) {
        try {
            await loginDemoRole(role);
        } catch (e) {
            showToast(e.message);
        }
    } else {
        saveState();
        showToast(`Switched to ${role.charAt(0).toUpperCase() + role.slice(1)} view`);
    }
    renderAll();
}

function renderHomeFeatured() {
    const grid = document.getElementById('homeFeaturedGrid');
    if (!grid) return;
    grid.innerHTML = state.courses.slice(0, 3).map(courseCardHTML).join('');
}

function renderCourses() {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;
    const filtered = state.activeCategory === 'all'
        ? state.courses
        : state.courses.filter(c => c.category === state.activeCategory);
    grid.innerHTML = filtered.map(courseCardHTML).join('');
}

function courseCardHTML(course) {
    const isEnrolled = state.enrolledIds.includes(course.id);
    const prog = course.progress || (state.currentUser?.progress?.[course.id]) || 0;
    return `
    <article class="card">
        <div class="card-thumb">
            <div class="thumb-icon">&#9654;</div>
            <span class="badge badge-blue">${course.category}</span>
        </div>
        <div class="card-body">
            <div class="card-meta">
                <span>${course.instructor}</span>
                <span>${course.lessons} lessons &bull; ${course.duration}</span>
            </div>
            <h3 class="card-title">${course.title}</h3>
            <p class="card-desc">${course.description}</p>
            <div class="card-footer">
                <span class="badge ${isEnrolled ? 'badge-teal' : 'badge-slate'}">
                    ${isEnrolled ? `Enrolled (${prog}%)` : 'Self-Paced'}
                </span>
                <button class="btn btn-primary btn-sm" onclick="watchCourse(${course.id})">
                    ${isEnrolled ? 'Watch Lesson' : 'Enroll & Watch'}
                </button>
            </div>
        </div>
    </article>`;
}

async function watchCourse(courseId) {
    const course = state.courses.find(c => c.id === courseId);
    if (!course) return;
    state.activeVideoCourseId = courseId;

    if (!state.enrolledIds.includes(courseId)) {
        if (state.apiConnected) {
            try {
                const res = await apiFetch(`/api/courses/${courseId}/enroll`, { method: 'POST' });
                applyUserToState(res.user);
            } catch (e) {}
        } else {
            state.enrolledIds.push(courseId);
            course.progress = 15;
        }
        saveState();
        renderCourses();
        renderHomeFeatured();
        renderProfile();
        showToast(`Enrolled in "${course.title}"`);
    }
    openVideoModal(course.title, `Instructor: ${course.instructor} • ${course.lessons} Lessons`, course.duration, course.videoUrl);
}

function renderLiveSessions() {
    const grid = document.getElementById('liveGrid');
    if (!grid) return;
    grid.innerHTML = state.liveSessions.map(item => {
        const isRecorded = item.status === 'recorded';
        const isReg = state.registeredLiveIds.includes(item.id);
        return `
        <article class="card">
            <div class="card-body">
                <div class="card-meta">
                    <span class="badge ${isRecorded ? 'badge-teal' : 'badge-blue'}">
                        ${isRecorded ? 'Recorded Replay' : 'Upcoming Live'}
                    </span>
                    <span>${item.date}</span>
                </div>
                <h3 class="card-title">${item.title}</h3>
                <p class="card-desc">${item.description} Hosted by <strong>${item.host}</strong> (${item.duration}).</p>
                <div class="card-footer">
                    <span class="badge badge-slate">${item.duration}</span>
                    ${isRecorded
                        ? `<button class="btn btn-teal btn-sm" onclick="openVideoModal('${escapeAttr(item.title)}', 'Live Session Recording • ${escapeAttr(item.host)}', '${item.duration}', '${escapeAttr(item.videoUrl || '')}')">&#9654; Watch Recording</button>`
                        : `<button class="btn ${isReg ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="toggleLiveReg(${item.id})">${isReg ? 'Registered ✓' : 'Reserve Seat'}</button>`
                    }
                </div>
            </div>
        </article>`;
    }).join('');
}

async function toggleLiveReg(id) {
    if (state.apiConnected) {
        try {
            const res = await apiFetch(`/api/live-sessions/${id}/register`, { method: 'POST' });
            applyUserToState(res.user);
            showToast(state.registeredLiveIds.includes(id) ? 'Seat reserved!' : 'Registration cancelled');
        } catch (e) {
            showToast(e.message);
        }
    } else {
        if (state.registeredLiveIds.includes(id)) {
            state.registeredLiveIds = state.registeredLiveIds.filter(x => x !== id);
            showToast('Registration cancelled');
        } else {
            state.registeredLiveIds.push(id);
            showToast('Seat reserved!');
        }
    }
    saveState();
    renderLiveSessions();
    renderProfile();
}

function renderStore() {
    const grid = document.getElementById('storeGrid');
    if (!grid) return;
    grid.innerHTML = state.products.map(p => {
        const owned = state.purchasedProductIds.includes(p.id);
        return `
        <article class="card">
            <div class="card-body">
                <div class="card-meta">
                    <span class="badge badge-blue">${p.type}</span>
                    <span>Instant Download</span>
                </div>
                <h3 class="card-title">${p.title}</h3>
                <p class="card-desc">${p.description}</p>
                <div class="card-footer">
                    <span class="price-tag">&#8377;${p.price}</span>
                    ${owned
                        ? `<button class="btn btn-teal btn-sm" onclick="downloadProduct(${p.id}, '${escapeAttr(p.title)}')">Download ✓</button>`
                        : `<button class="btn btn-primary btn-sm" onclick="openCheckout(${p.id})">Buy with Razorpay</button>`
                    }
                </div>
            </div>
        </article>`;
    }).join('');
}

async function downloadProduct(id, title) {
    if (state.apiConnected && state.token) {
        try {
            const res = await fetch(`/api/products/${id}/download`, {
                headers: { Authorization: `Bearer ${state.token}` }
            });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/\s+/g, '_')}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Downloaded "${title}"`);
            return;
        } catch (e) {}
    }
    showToast(`Downloading "${title}"...`);
}

function openCheckout(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    state.activeCheckoutProduct = product;
    document.getElementById('checkoutItemName').textContent = `${product.title} (${product.type})`;
    document.getElementById('checkoutItemPrice').textContent = `₹${product.price}`;
    document.getElementById('checkoutStatus').textContent = '';
    document.getElementById('confirmPayBtn').disabled = false;
    document.getElementById('checkoutModal').classList.add('open');
}

async function confirmMockPayment() {
    if (!state.activeCheckoutProduct) return;
    const btn = document.getElementById('confirmPayBtn');
    btn.disabled = true;
    document.getElementById('checkoutStatus').textContent = 'Creating Razorpay order...';

    try {
        if (state.apiConnected) {
            const order = await apiFetch('/api/orders/create', {
                method: 'POST',
                body: JSON.stringify({ productId: state.activeCheckoutProduct.id })
            });
            document.getElementById('checkoutStatus').textContent = `Verifying ${order.id}...`;
            const verified = await apiFetch('/api/orders/verify', {
                method: 'POST',
                body: JSON.stringify({ orderId: order.id, productId: state.activeCheckoutProduct.id })
            });
            applyUserToState(verified.user);
        } else {
            if (!state.purchasedProductIds.includes(state.activeCheckoutProduct.id)) {
                state.purchasedProductIds.push(state.activeCheckoutProduct.id);
            }
        }
        saveState();
        document.getElementById('checkoutStatus').textContent = 'Payment successful! Download unlocked.';
        renderStore();
        renderProfile();
        showToast(`Purchased "${state.activeCheckoutProduct.title}"`);
        setTimeout(() => closeModal('checkoutModal'), 800);
    } catch (e) {
        btn.disabled = false;
        document.getElementById('checkoutStatus').textContent = e.message;
    }
}

function downloadCertificate(courseId = 1) {
    const name = encodeURIComponent(state.currentUser?.name || 'Aarav Sharma');
    if (state.apiConnected) {
        window.open(`/api/certificate/${courseId}?name=${name}`, '_blank');
        showToast('Generating PDF Certificate...');
    } else {
        showToast('Opening print-ready Certificate...');
        window.print();
    }
}

function renderNewsletters() {
    const list = document.getElementById('newsletterList');
    if (!list) return;
    list.innerHTML = state.newsletters.map(nl => `
        <div class="archive-item">
            <div>
                <small style="color: var(--text-muted);">${nl.date}</small>
                <h4 style="font-size: 1rem; margin: 0.15rem 0;">${nl.title}</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${nl.summary}</p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="openNewsletter(${nl.id})">Read</button>
        </div>
    `).join('');
}

function openNewsletter(id) {
    const nl = state.newsletters.find(n => n.id === id);
    if (!nl) return;
    document.getElementById('nlModalTitle').textContent = nl.title;
    document.getElementById('nlModalBody').innerHTML = `
        <p style="margin-bottom:0.75rem;"><strong>Published:</strong> ${nl.date}</p>
        <p>${nl.body}</p>
    `;
    document.getElementById('newsletterModal').classList.add('open');
}

function renderProfile() {
    const container = document.getElementById('profileContent');
    if (!container) return;

    document.querySelectorAll('#profileRoleTabs .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === state.activeRole);
    });

    if (state.activeRole === 'student') {
        const enrolledCourses = state.courses.filter(c => state.enrolledIds.includes(c.id));
        const ownedProducts = state.products.filter(p => state.purchasedProductIds.includes(p.id));
        const displayName = state.currentUser?.name || 'Aarav Sharma';
        container.innerHTML = `
            <div class="profile-top">
                <div class="profile-user">
                    <div class="avatar">${displayName.split(' ').map(w => w[0]).join('').slice(0,2)}</div>
                    <div>
                        <h3>${displayName}</h3>
                        <span class="badge badge-teal">Student Account</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="downloadCertificate(1)">Download Certificate (PDF)</button>
            </div>
            <div class="stats-row">
                <div class="stat-box"><small>Enrolled Courses</small><strong>${enrolledCourses.length}</strong></div>
                <div class="stat-box"><small>Live Sessions Reserved</small><strong>${state.registeredLiveIds.length}</strong></div>
                <div class="stat-box"><small>Digital Products</small><strong>${ownedProducts.length}</strong></div>
                <div class="stat-box"><small>Certificates Earned</small><strong>1</strong></div>
            </div>
            <h4>My Enrolled Courses</h4>
            <table class="data-table">
                <thead><tr><th>Course</th><th>Instructor</th><th>Progress</th><th>Action</th></tr></thead>
                <tbody>
                    ${enrolledCourses.map(c => `
                        <tr>
                            <td><strong>${c.title}</strong></td>
                            <td>${c.instructor}</td>
                            <td>${c.progress || 0}%</td>
                            <td><button class="btn btn-teal btn-sm" onclick="watchCourse(${c.id})">Continue</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (state.activeRole === 'instructor') {
        const displayName = state.currentUser?.name || 'Rohan Mehta';
        container.innerHTML = `
            <div class="profile-top">
                <div class="profile-user">
                    <div class="avatar">RM</div>
                    <div>
                        <h3>${displayName}</h3>
                        <span class="badge badge-blue">Instructor Studio</span>
                    </div>
                </div>
                <span class="badge badge-teal">Verified Creator</span>
            </div>
            <div class="stats-row">
                <div class="stat-box"><small>Published Courses</small><strong>${state.courses.length}</strong></div>
                <div class="stat-box"><small>Total Students</small><strong>1,240</strong></div>
                <div class="stat-box"><small>Live Recordings</small><strong>${state.liveSessions.filter(l => l.status === 'recorded').length}</strong></div>
                <div class="stat-box"><small>Course Rating</small><strong>4.9 / 5</strong></div>
            </div>
            <h4>Publish New Recorded Course</h4>
            <form id="instructorAddCourse" class="form-grid">
                <input type="text" id="newCourseTitle" placeholder="Course Title" required />
                <select id="newCourseCat">
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Data & AI">Data &amp; AI</option>
                    <option value="Business">Business</option>
                </select>
                <input type="text" id="newCourseDuration" placeholder="Duration (e.g., 4h 20m)" required />
                <input type="text" id="newCourseDesc" placeholder="Short description" required />
                <input type="file" id="newCourseVideo" accept="video/*" title="Optional MP4/WebM video file" />
                <button type="submit" class="btn btn-primary">Publish to Catalog</button>
            </form>
        `;
        document.getElementById('instructorAddCourse').addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('newCourseTitle').value.trim();
            const category = document.getElementById('newCourseCat').value;
            const duration = document.getElementById('newCourseDuration').value.trim();
            const description = document.getElementById('newCourseDesc').value.trim();
            const videoFile = document.getElementById('newCourseVideo').files[0];

            try {
                let created;
                if (state.apiConnected) {
                    const fd = new FormData();
                    fd.append('title', title);
                    fd.append('category', category);
                    fd.append('duration', duration);
                    fd.append('description', description);
                    if (videoFile) fd.append('video', videoFile);
                    created = await apiFetch('/api/courses', { method: 'POST', body: fd });
                } else {
                    created = { id: Date.now(), title, category, instructor: displayName, duration, lessons: 10, progress: 0, description };
                }
                state.courses.unshift(created);
                saveState();
                renderAll();
                showToast(`Published "${title}" to Courses!`);
            } catch (err) {
                showToast(err.message);
            }
        });
    } else {
        const displayName = state.currentUser?.name || 'Priya Nair';
        container.innerHTML = `
            <div class="profile-top">
                <div class="profile-user">
                    <div class="avatar">PN</div>
                    <div>
                        <h3>${displayName}</h3>
                        <span class="badge badge-blue">Platform Admin</span>
                    </div>
                </div>
                <span class="badge badge-teal">System Healthy</span>
            </div>
            <div class="stats-row">
                <div class="stat-box"><small>Total Users</small><strong>${state.usersList.length}</strong></div>
                <div class="stat-box"><small>Active Courses</small><strong>${state.courses.length}</strong></div>
                <div class="stat-box"><small>Digital Products</small><strong>${state.products.length}</strong></div>
                <div class="stat-box"><small>Newsletter Issues</small><strong>${state.newsletters.length}</strong></div>
            </div>
            <h4>User &amp; Role Management</h4>
            <table class="data-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
                <tbody>
                    ${state.usersList.map(u => `
                        <tr>
                            <td><strong>${u.name}</strong></td>
                            <td>${u.email}</td>
                            <td><span class="badge badge-blue">${u.role}</span></td>
                            <td><span class="badge badge-teal">${u.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <h4 style="margin-top:1.5rem;">Dispatch New Newsletter Issue</h4>
            <form id="adminNewsletterForm" class="form-grid">
                <input type="text" id="nlTitle" placeholder="Issue Title" required />
                <input type="text" id="nlSummary" placeholder="Short summary" required />
                <button type="submit" class="btn btn-teal">Publish Newsletter</button>
            </form>
        `;
        document.getElementById('adminNewsletterForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('nlTitle').value.trim();
            const summary = document.getElementById('nlSummary').value.trim();
            try {
                let created;
                if (state.apiConnected) {
                    created = await apiFetch('/api/newsletters', {
                        method: 'POST',
                        body: JSON.stringify({ title, summary, body: summary })
                    });
                } else {
                    created = { id: Date.now(), title, date: 'Nov 24, 2026', summary, body: summary };
                }
                state.newsletters.unshift(created);
                saveState();
                renderAll();
                showToast('Newsletter published!');
            } catch (err) {
                showToast(err.message);
            }
        });
    }
}

function openVideoModal(title, subtitle, duration, videoUrl = '') {
    document.getElementById('videoModalTitle').textContent = title;
    document.getElementById('videoModalSubtitle').textContent = subtitle;
    const screen = document.querySelector('#videoModal .video-screen');
    if (screen) {
        if (videoUrl) {
            screen.innerHTML = `<video src="${videoUrl}" controls autoplay style="width:100%; height:100%; object-fit:contain; background:#000;"></video>`;
        } else {
            screen.innerHTML = `<div class="play-pulse">&#9654;</div><p>Playing HD Stream &bull; <span id="videoDuration">${duration}</span></p>`;
        }
    }
    const endEl = document.getElementById('videoDurationEnd');
    if (endEl) endEl.textContent = duration;
    document.getElementById('videoModal').classList.add('open');
}

async function markLessonComplete() {
    if (state.apiConnected && state.activeVideoCourseId) {
        try {
            const res = await apiFetch(`/api/courses/${state.activeVideoCourseId}/progress`, {
                method: 'POST',
                body: JSON.stringify({ percent: 100 })
            });
            applyUserToState(res.user);
            saveState();
            renderAll();
        } catch (e) {}
    }
    showToast('Lesson marked complete! Progress updated.');
    closeModal('videoModal');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function escapeAttr(str) {
    return String(str).replace(/'/g, "\\'");
}
