const API_URL = 'https://ser-sustentvel-rede-social.onrender.com/auth'; 
let currentUser = null;
let editAvatarBase64 = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

// ==========================================
// PROXY DE IMAGENS (Correção do Erro VARCHAR 255 do Back-end)
// ==========================================
// O back-end define caminho_foto como VARCHAR(255). Uma imagem Base64 real passará de milhões de caracteres e quebrará o banco de dados. 
// Para burlar essa limitação estrutural sem mexer no back-end, salvamos a string enorme no LocalStorage e enviamos apenas uma "chave curta" pro BD.
function salvarImagemProxyLocal(base64Str) {
    if (!base64Str) return "";
    const imgKey = 'localimg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    try {
        localStorage.setItem(imgKey, base64Str);
        return imgKey;
    } catch (e) {
        showToast('A imagem é grande demais para ser armazenada.', 'error');
        return "";
    }
}
function recuperarImagemProxyLocal(dbString) {
    if (dbString && dbString.startsWith('localimg_')) {
        return localStorage.getItem(dbString) || "";
    }
    return dbString; 
}


function initApp() {
    const savedSession = sessionStorage.getItem('ser_sustentavel_session');
    const savedTheme = localStorage.getItem('ser_sustentavel_theme') || 'dark';
    setTheme(savedTheme);

    if (savedSession) {
        try {
            currentUser = JSON.parse(savedSession);
            showScreen('main-app');
            updateHeader();
            renderFeed('feed-container', false);
            atualizarListaSeguidores();
        } catch (e) {
            handleLogout();
        }
    } else {
        showScreen('login-screen');
    }
}

function showScreen(screenId) {
    const screens = ['login-screen', 'register-screen', 'main-app'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (id === screenId) {
            el.classList.remove('hidden');
            el.classList.add('fade-in');
        } else {
            el.classList.add('hidden');
            el.classList.remove('fade-in');
        }
    });
}

function switchAppView(viewId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(viewId).classList.remove('hidden');

    if (viewId === 'view-feed') {
        document.getElementById('nav-feed-btn').classList.add('active');
        renderFeed('feed-container', false);
    } else if (viewId === 'view-profile') {
        document.getElementById('nav-profile-btn').classList.add('active');
        prepararAbaPerfil();
    } else if (viewId === 'view-habits') {
        document.getElementById('nav-habits-btn').classList.add('active');
        renderHabitsLog();
    } else if (viewId === 'view-forum') {
        document.getElementById('nav-forum-btn').classList.add('active');
        renderForumMock();
    }
}

async function prepararAbaPerfil() {
    document.getElementById('edit-profile-form').classList.add('hidden');
    document.getElementById('btn-edit-profile').classList.remove('hidden');
    document.getElementById('profile-name-display').innerText = currentUser.nome;
    
    const dataMembro = currentUser.data_criacao || currentUser.data_cadastro;
    document.getElementById('profile-join-date').innerText = dataMembro ? formatarData(dataMembro, false) : 'Recente';

    const aboutEl = document.getElementById('profile-about-display');
    if (currentUser.sobre_mim) {
        aboutEl.innerText = `"${currentUser.sobre_mim}"`;
        aboutEl.classList.remove('hidden');
    } else {
        aboutEl.classList.add('hidden');
    }

    const avatarEl = document.getElementById('profile-avatar-display');
    const avatarData = recuperarImagemProxyLocal(currentUser.avatar);
    if (avatarData) {
        avatarEl.innerHTML = `<img src="${avatarData}" alt="Foto de perfil">`;
    } else {
        avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
    }

    renderFeed('profile-posts-container', true);
    
    // FETCH REAL DAS ESTATÍSTICAS DA ROTA DO BACK-END (Correção de Inconsistência)
    const token = sessionStorage.getItem('token_jwt');
    try {
        const response = await fetch(`${API_URL}/perfil?token=${token}`);
        if(response.ok) {
            const data = await response.json();
            document.getElementById('stat-posts').innerText = data.metricas.acoes_compartilhadas;
            document.getElementById('stat-likes').innerText = data.metricas.eco_curtidas_recebidas;
        }
    } catch (e) {
        console.error("Erro ao puxar dados do perfil", e);
    }
}

function setupEventListeners() {
    document.getElementById('go-to-register-btn').addEventListener('click', () => { document.getElementById('register-form').reset(); showScreen('register-screen'); });
    document.getElementById('go-to-login-btn').addEventListener('click', () => { document.getElementById('login-form').reset(); showScreen('login-screen'); });

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    const dropdownBtn = document.getElementById('user-header-dropdown-btn');
    const dropdownMenu = document.getElementById('profile-dropdown-menu');
    dropdownBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenu.classList.toggle('hidden'); });
    document.addEventListener('click', () => dropdownMenu.classList.add('hidden'));

    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => btn.addEventListener('click', toggleTheme));
    setupPasswordVisibility('toggle-login-pass', 'login-password');
    setupPasswordVisibility('toggle-reg-pass', 'reg-password');
    setupPasswordVisibility('toggle-reg-confirm-pass', 'reg-confirm-password');

    document.getElementById('nav-feed-btn').addEventListener('click', () => switchAppView('view-feed'));
    document.getElementById('nav-profile-btn').addEventListener('click', () => switchAppView('view-profile'));
    document.getElementById('nav-habits-btn').addEventListener('click', () => switchAppView('view-habits'));
    document.getElementById('nav-forum-btn').addEventListener('click', () => switchAppView('view-forum'));

    document.getElementById('create-post-form').addEventListener('submit', handleCreatePost);
    document.getElementById('post-media').addEventListener('change', handleFileSelect);

    document.getElementById('btn-edit-profile').addEventListener('click', () => {
        document.getElementById('edit-profile-form').classList.remove('hidden');
        document.getElementById('btn-edit-profile').classList.add('hidden');
        document.getElementById('edit-about').value = currentUser.sobre_mim || '';
        editAvatarBase64 = currentUser.avatar; 
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        document.getElementById('edit-profile-form').classList.add('hidden');
        document.getElementById('btn-edit-profile').classList.remove('hidden');
    });

    document.getElementById('edit-avatar').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return showToast('Apenas arquivos de imagem.', 'error');
        const reader = new FileReader();
        reader.onload = (event) => { editAvatarBase64 = event.target.result; };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-save-profile').addEventListener('click', handleEditProfileSave);
    
    // Form do Fórum Simulado
    document.getElementById('create-topic-form').addEventListener('submit', handleCreateForumTopic);
}

async function handleEditProfileSave() {
    const novoSobreMim = document.getElementById('edit-about').value.trim();
    
    // Evita enviar string enorme e quebrar o DB. Se tiver avatar novo, cria proxy local.
    let proxyAvatarDb = editAvatarBase64; 
    if(editAvatarBase64 && editAvatarBase64.startsWith('data:image')) {
        proxyAvatarDb = salvarImagemProxyLocal(editAvatarBase64);
    }
    
    currentUser.sobre_mim = novoSobreMim;
    currentUser.avatar = proxyAvatarDb;
    sessionStorage.setItem('ser_sustentavel_session', JSON.stringify(currentUser));
    
    showToast('Perfil atualizado (dados salvos localmente)!', 'success');
    switchAppView('view-profile'); 
}

function setupPasswordVisibility(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    btn.addEventListener('click', () => {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
}

function toggleTheme() {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ser_sustentavel_theme', theme);
    document.querySelectorAll('.theme-icon').forEach(icon => {
        icon.className = theme === 'dark' ? 'fa-solid fa-sun theme-icon' : 'fa-solid fa-moon theme-icon';
    });
}

function calcularIdade(dataNascimento) {
    const hoje = new Date(); const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < (nascimento.getDate() + 1))) idade--;
    return idade;
}

// ----------------------------------------------------
// INTEGRAÇÕES FAST API AUTH & FEED
// ----------------------------------------------------
async function handleRegister(e) {
    e.preventDefault();
    const nome = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const dob = document.getElementById('reg-dob').value;
    const senha = document.getElementById('reg-password').value;
    const confirmSenha = document.getElementById('reg-confirm-password').value;

    if (!nome || !email || !dob || !senha || !confirmSenha) return showToast('Preencha todos os campos.', 'error');
    if (calcularIdade(dob) < 16) return showToast('Mínimo 16 anos permitidos.', 'error');
    if (senha.length < 6) return showToast('Mínimo 6 caracteres.', 'error');
    if (senha !== confirmSenha) return showToast('As senhas não coincidem.', 'error');

    try {
        const response = await fetch(`${API_URL}/cadastro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: nome, email: email, data_nascimento: dob, senha: senha })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Conta criada com sucesso!', 'success');
            document.getElementById('register-form').reset();
            document.getElementById('login-email').value = email;
            showScreen('login-screen');
        } else showToast(data.detail || 'Erro ao cadastrar.', 'error');
    } catch (error) { showToast('Erro de conexão com o servidor.', 'error'); }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const senha = document.getElementById('login-password').value;
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, senha: senha })
        });
        const data = await response.json();
        if (response.ok) {
            currentUser = data.usuario;
            sessionStorage.setItem('token_jwt', data.token_sessao);
            sessionStorage.setItem('ser_sustentavel_session', JSON.stringify(currentUser));
            showToast(`Bem-vindo, ${currentUser.nome}! 🌿`, 'success');
            document.getElementById('login-form').reset();
            showScreen('main-app');
            updateHeader();
            atualizarListaSeguidores();
            switchAppView('view-feed');
        } else showToast(data.detail || 'Credenciais incorretas.', 'error');
    } catch (error) { showToast('Erro de conexão.', 'error'); }
}

async function handleLogout() {
    const token = sessionStorage.getItem('token_jwt');
    if(token) try { await fetch(`${API_URL}/logout?token=${token}`, { method: 'POST' }); } catch(e){}
    currentUser = null;
    sessionStorage.removeItem('ser_sustentavel_session');
    sessionStorage.removeItem('token_jwt');
    showScreen('login-screen');
}

function updateHeader() { if(currentUser) document.getElementById('header-username').innerText = currentUser.nome; }

let selectedMediaBase64 = null;
function handleFileSelect(e) {
    const file = e.target.files[0];
    const display = document.getElementById('file-name-display');
    if (!file) {
        display.innerText = "Nenhuma mídia selecionada";
        selectedMediaBase64 = null;
        return;
    }
    display.innerText = file.name;
    const reader = new FileReader();
    reader.onload = (event) => { selectedMediaBase64 = event.target.result; };
    reader.readAsDataURL(file);
}

async function handleCreatePost(e) {
    e.preventDefault();
    const content = document.getElementById('post-content').value.trim();
    const token = sessionStorage.getItem('token_jwt');
    if (!content && !selectedMediaBase64) return showToast('A publicação não pode estar vazia.', 'error');

    // Usa a chave de proxy da imagem para salvar no banco corretamente
    const caminho_seguro_db = salvarImagemProxyLocal(selectedMediaBase64);

    try {
        const response = await fetch(`${API_URL}/postar?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ legenda: content, caminho_foto: caminho_seguro_db })
        });

        if (response.ok) {
            showToast('Ação ecológica publicada! 🌿', 'success');
            document.getElementById('create-post-form').reset();
            document.getElementById('file-name-display').innerText = "Nenhuma mídia selecionada";
            selectedMediaBase64 = null;
            renderFeed('feed-container', false);
        } else {
            const err = await response.json(); showToast(err.detail, 'error');
        }
    } catch (error) { showToast('Erro de conexão.', 'error'); }
}

async function renderFeed(containerId, apenasUsuarioLogado) {
    const container = document.getElementById(containerId);
    try {
        const response = await fetch(`${API_URL}/feed`);
        let dbPublicacoes = await response.json();

        if (apenasUsuarioLogado) {
            dbPublicacoes = dbPublicacoes.filter(p => p.autor === currentUser.nome);
        }

        container.innerHTML = '';
        if (dbPublicacoes.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-leaf" style="font-size: 2rem; color: var(--accent-mint); margin-bottom: 10px;"></i><p>Nenhuma publicação encontrada.</p></div>`;
            return;
        }

        dbPublicacoes.forEach(post => {
            const card = document.createElement('article');
            card.className = 'post-card glass-panel fade-in';
            
            // Restaura o Base64 enorme pegando pelo Proxy Local ID
            const imagemRealBase64 = recuperarImagemProxyLocal(post.caminho_foto);
            let mediaHtml = '';
            if (imagemRealBase64 && imagemRealBase64.length > 10) {
                mediaHtml = `<div class="post-media-container"><img src="${imagemRealBase64}" alt="Mídia da postagem"></div>`;
            }

            // Checagem de Follow (Simulada no Local Storage)
            const isMe = post.autor === currentUser.nome;
            const amIFollowing = listaSeguindo.includes(post.autor);
            const followBtnHtml = isMe ? '' : `<button class="btn-follow ${amIFollowing ? 'following' : ''}" onclick="toggleFollow('${post.autor}')">${amIFollowing ? '<i class="fa-solid fa-check"></i> Seguindo' : 'Seguir'}</button>`;
            const deleteBtn = isMe ? `<button class="btn-delete-post" onclick="deletePost(${post.id_postagem})" title="Excluir"><i class="fa-solid fa-trash"></i></button>` : '';

            let commentsHtml = '';
            post.comentarios.forEach(com => {
                commentsHtml += `<div class="comment-item"><span class="comment-author">${com.autor} <span style="font-size: 0.7rem; color: var(--text-muted)">${com.data || ''}</span></span><p class="comment-text">${com.texto}</p></div>`;
            });

            card.innerHTML = `
                <div class="post-header">
                    <div class="post-author">
                        <div class="post-author-name-row">
                            <span>${post.autor}</span> ${followBtnHtml}
                        </div>
                        <span class="post-date">${formatarData(post.data_criacao, true)}</span>
                    </div>
                    ${deleteBtn}
                </div>
                
                <div class="post-content-text">${post.legenda}</div>
                ${mediaHtml}

                <div class="post-interaction-bar">
                    <button class="interaction-btn" onclick="toggleLike(${post.id_postagem})">
                        <i class="fa-solid fa-leaf"></i> Eco-Curtidas (${post.total_curtidas})
                    </button>
                    <button class="interaction-btn" onclick="toggleCommentBox(${post.id_postagem})">
                        <i class="fa-regular fa-comment"></i> Comentar (${post.comentarios.length})
                    </button>
                </div>

                <div class="comments-section hidden" id="comment-box-${post.id_postagem}">
                    <div id="comments-list-${post.id_postagem}">${commentsHtml}</div>
                    <div class="add-comment-form">
                        <input type="text" id="comment-input-${post.id_postagem}" placeholder="Adicione um comentário...">
                        <button onclick="addComment(${post.id_postagem})"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) { container.innerHTML = `<p style="color: var(--danger)">Erro ao carregar o feed.</p>`; }
}

window.deletePost = async function(idPublicacao) {
    if (!confirm('Deseja realmente apagar esta publicação?')) return;
    const token = sessionStorage.getItem('token_jwt');
    try {
        const response = await fetch(`${API_URL}/postar/${idPublicacao}?token=${token}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('Publicação excluída!', 'success');
            const isProfileActive = document.getElementById('nav-profile-btn').classList.contains('active');
            renderFeed(isProfileActive ? 'profile-posts-container' : 'feed-container', isProfileActive);
        }
    } catch (error) { showToast('Erro de conexão.', 'error'); }
};

window.toggleLike = async function(idPublicacao) {
    const token = sessionStorage.getItem('token_jwt');
    try {
        const response = await fetch(`${API_URL}/curtir/${idPublicacao}?token=${token}`, { method: 'POST' });
        if(response.ok) {
            const isProfileActive = document.getElementById('nav-profile-btn').classList.contains('active');
            renderFeed(isProfileActive ? 'profile-posts-container' : 'feed-container', isProfileActive);
        }
    } catch (error) { showToast('Erro ao processar curtida.', 'error'); }
};

window.toggleCommentBox = function(idPublicacao) { document.getElementById(`comment-box-${idPublicacao}`).classList.toggle('hidden'); };

window.addComment = async function(idPublicacao) {
    const input = document.getElementById(`comment-input-${idPublicacao}`);
    const texto = input.value.trim();
    const token = sessionStorage.getItem('token_jwt');
    if (!texto) return;

    try {
        const response = await fetch(`${API_URL}/comentar/${idPublicacao}?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto: texto })
        });
        if (response.ok) {
            const isProfileActive = document.getElementById('nav-profile-btn').classList.contains('active');
            renderFeed(isProfileActive ? 'profile-posts-container' : 'feed-container', isProfileActive);
        }
    } catch (error) { showToast('Erro de conexão.', 'error'); }
};

// Correção do Data parser 
function formatarData(isoString, comHora = false) {
    if (!isoString) return '';
    // Proteção: Se a API já devolveu a data formatada e com barras, retorne a própria string.
    if (typeof isoString === 'string' && isoString.includes('/')) return isoString; 

    const data = new Date(isoString);
    if (isNaN(data)) return isoString; 

    const opções = { day: '2-digit', month: 'short', year: 'numeric' };
    if (comHora) { opções.hour = '2-digit'; opções.minute = '2-digit'; }
    return data.toLocaleDateString('pt-BR', opções).replace(' de ', '/').replace('. de ', '/');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type} fade-in`;
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle" style="color: var(--accent-emerald)"></i>' : '<i class="fa-solid fa-circle-exclamation" style="color: var(--danger)"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}


// ==========================================
// MÓDULOS DE REQUISITOS ADICIONAIS (Simulados Localmente)
// ==========================================

// --- SEGUIDORES ---
let listaSeguindo = [];
function atualizarListaSeguidores() {
    const dbSeguidores = JSON.parse(localStorage.getItem('serSustentavel_seguidores') || '{}');
    if(!dbSeguidores[currentUser.id_usuario]) dbSeguidores[currentUser.id_usuario] = [];
    listaSeguindo = dbSeguidores[currentUser.id_usuario];
    if(document.getElementById('stat-followers')) document.getElementById('stat-followers').innerText = listaSeguindo.length;
}

window.toggleFollow = function(nomeAutor) {
    const dbSeguidores = JSON.parse(localStorage.getItem('serSustentavel_seguidores') || '{}');
    if(!dbSeguidores[currentUser.id_usuario]) dbSeguidores[currentUser.id_usuario] = [];
    
    let meusSeguidos = dbSeguidores[currentUser.id_usuario];
    if(meusSeguidos.includes(nomeAutor)) {
        meusSeguidos = meusSeguidos.filter(n => n !== nomeAutor);
        showToast(`Você deixou de seguir ${nomeAutor}.`);
    } else {
        meusSeguidos.push(nomeAutor);
        showToast(`Você está seguindo ${nomeAutor}!`, 'success');
    }
    
    dbSeguidores[currentUser.id_usuario] = meusSeguidos;
    localStorage.setItem('serSustentavel_seguidores', JSON.stringify(dbSeguidores));
    atualizarListaSeguidores();
    renderFeed('feed-container', false);
}

// --- HÁBITOS ---
window.registerHabit = function(nomeHabito) {
    const dbHabitos = JSON.parse(localStorage.getItem('serSustentavel_habitos') || '[]');
    dbHabitos.unshift({ id_usuario: currentUser.id_usuario, habito: nomeHabito, data: new Date().toISOString() });
    localStorage.setItem('serSustentavel_habitos', JSON.stringify(dbHabitos));
    showToast(`Hábito '${nomeHabito}' registrado! +10 Eco-Pontos`, 'success');
    renderHabitsLog();
}

function renderHabitsLog() {
    const container = document.getElementById('habits-log-container');
    const dbHabitos = JSON.parse(localStorage.getItem('serSustentavel_habitos') || '[]');
    const meusHabitos = dbHabitos.filter(h => h.id_usuario === currentUser.id_usuario).slice(0, 5); // ultimos 5
    
    if(meusHabitos.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size:0.9rem;">Nenhum hábito registrado recentemente.</p>';
        return;
    }
    container.innerHTML = meusHabitos.map(h => `<div class="habit-log-item"><span>${h.habito}</span> ${formatarData(h.data, true)}</div>`).join('');
}

// --- FÓRUM ---
function handleCreateForumTopic(e) {
    e.preventDefault();
    const titulo = document.getElementById('topic-title').value;
    const conteudo = document.getElementById('topic-content').value;
    
    const dbForum = JSON.parse(localStorage.getItem('serSustentavel_forum') || '[]');
    dbForum.unshift({
        titulo: titulo, conteudo: conteudo, autor: currentUser.nome, data: new Date().toISOString(),
    });
    localStorage.setItem('serSustentavel_forum', JSON.stringify(dbForum));
    
    document.getElementById('create-topic-form').reset();
    showToast('Tópico criado com sucesso!', 'success');
    renderForumMock();
}

function renderForumMock() {
    const container = document.getElementById('forum-container');
    const dbForum = JSON.parse(localStorage.getItem('serSustentavel_forum') || '[]');
    if(dbForum.length === 0) {
        container.innerHTML = `<div class="empty-state">O fórum está vazio. Comece o debate!</div>`;
        return;
    }
    
    container.innerHTML = dbForum.map(t => `
        <div class="post-card glass-panel fade-in">
            <h4 style="color: var(--accent-mint); margin-bottom: 5px;">${t.titulo}</h4>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">Aberto por ${t.autor} em ${formatarData(t.data, true)}</div>
            <p style="font-size: 0.95rem;">${t.conteudo}</p>
        </div>
    `).join('');
}