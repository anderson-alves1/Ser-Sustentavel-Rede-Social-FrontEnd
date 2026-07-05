const API_URL = 'https://ser-sustentavel-rede-social.onrender.com/auth';
const BASE_URL = 'https://ser-sustentavel-rede-social.onrender.com';
let currentUser = null;
let editAvatarFile = null;
let topicoAtualId = null;  // ID do tópico do fórum aberto

// ═══════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function uploadArquivoParaBackend(file) {
    if (!file) return "";
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Falha no upload");
        const data = await res.json();
        return data.url;
    } catch (e) {
        showToast('Erro ao enviar a imagem para o servidor.', 'error');
        return "";
    }
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
        mostrarListaForum();
        carregarTopicos();
    }
}

// ═══════════════════════════════════════════
// PERFIL
// ═══════════════════════════════════════════

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
    if (currentUser.avatar) {
        const avatarUrl = currentUser.avatar.startsWith('http') ? currentUser.avatar : `${BASE_URL}${currentUser.avatar}`;
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Foto de perfil">`;
    } else {
        avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
    }

    renderFeed('profile-posts-container', true);

    const token = sessionStorage.getItem('token_jwt');
    try {
        const response = await fetch(`${API_URL}/perfil?token=${token}`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('stat-posts').innerText = data.metricas.acoes_compartilhadas;
            document.getElementById('stat-likes').innerText = data.metricas.eco_curtidas_recebidas;
            document.getElementById('stat-points').innerText = data.pontos || 0;
            // Atualiza pontos no objeto local
            currentUser.pontos = data.pontos || 0;
            sessionStorage.setItem('ser_sustentavel_session', JSON.stringify(currentUser));
        }
    } catch (e) {
        console.error("Erro ao puxar dados do perfil", e);
    }

    carregarRanking();
}

async function carregarRanking() {
    const container = document.getElementById('ranking-container');
    try {
        const res = await fetch(`${API_URL}/ranking`);
        if (!res.ok) throw new Error();
        const lista = await res.json();
        if (lista.length === 0) {
            container.innerHTML = '<p class="empty-state" style="padding:15px;">Nenhum usuário no ranking ainda.</p>';
            return;
        }
        container.innerHTML = lista.map(u => {
            const posClass = u.posicao === 1 ? 'top1' : u.posicao === 2 ? 'top2' : u.posicao === 3 ? 'top3' : '';
            const medal = u.posicao === 1 ? '🥇' : u.posicao === 2 ? '🥈' : u.posicao === 3 ? '🥉' : u.posicao;
            const avatarHtml = u.avatar
                ? `<img src="${u.avatar.startsWith('http') ? u.avatar : BASE_URL + u.avatar}" alt="${u.nome}">`
                : `<i class="fa-solid fa-user" style="font-size:0.85rem;"></i>`;
            return `
                <div class="ranking-item">
                    <span class="ranking-pos ${posClass}">${medal}</span>
                    <div class="ranking-avatar">${avatarHtml}</div>
                    <span class="ranking-name">${u.nome}</span>
                    <span class="ranking-points">${u.pontos} <span>pts</span></span>
                </div>
            `;
        }).join('');
    } catch {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:10px;">Não foi possível carregar o ranking.</p>';
    }
}

// ═══════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════

function setupEventListeners() {
    document.getElementById('go-to-register-btn').addEventListener('click', () => { document.getElementById('register-form').reset(); showScreen('register-screen'); });
    document.getElementById('go-to-login-btn').addEventListener('click', () => { document.getElementById('login-form').reset(); showScreen('login-screen'); });

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    // Dropdown do header
    const dropdownBtn = document.getElementById('user-header-dropdown-btn');
    const dropdownMenu = document.getElementById('profile-dropdown-menu');
    dropdownBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenu.classList.toggle('hidden'); });
    document.addEventListener('click', () => dropdownMenu.classList.add('hidden'));

    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    document.getElementById('btn-settings').addEventListener('click', (e) => { e.stopPropagation(); dropdownMenu.classList.add('hidden'); abrirModalConfiguracoes(); });

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => btn.addEventListener('click', toggleTheme));
    setupPasswordVisibility('toggle-login-pass', 'login-password');
    setupPasswordVisibility('toggle-reg-pass', 'reg-password');
    setupPasswordVisibility('toggle-reg-confirm-pass', 'reg-confirm-password');
    setupPasswordVisibility('toggle-settings-current', 'settings-current-pass');
    setupPasswordVisibility('toggle-settings-new', 'settings-new-pass');

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
        editAvatarFile = null;
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        document.getElementById('edit-profile-form').classList.add('hidden');
        document.getElementById('btn-edit-profile').classList.remove('hidden');
    });

    document.getElementById('edit-avatar').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return showToast('Apenas arquivos de imagem.', 'error');
        editAvatarFile = file;
    });

    document.getElementById('btn-save-profile').addEventListener('click', handleEditProfileSave);

    // Fórum
    document.getElementById('create-topic-form').addEventListener('submit', handleCreateForumTopic);
    document.getElementById('btn-back-forum').addEventListener('click', () => { topicoAtualId = null; mostrarListaForum(); carregarTopicos(); });
    document.getElementById('forum-comment-form').addEventListener('submit', handleForumComment);

    // Modal apagar post
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmarDeletarPost);
    // Modal apagar comentário
    document.getElementById('btn-confirm-delete-comment').addEventListener('click', confirmarDeletarComentario);

    // Modal configurações
    document.getElementById('settings-form').addEventListener('submit', handleSalvarConfiguracoes);

    // Pesquisa
    const searchInput = document.getElementById('search-input');
    const searchDropdown = document.getElementById('search-results-dropdown');
    let searchTimeout = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (q.length < 2) { searchDropdown.classList.add('hidden'); return; }
        searchTimeout = setTimeout(() => executarPesquisa(q), 350);
    });
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) searchDropdown.classList.remove('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!document.getElementById('search-bar-wrapper').contains(e.target)) {
            searchDropdown.classList.add('hidden');
        }
    });
}

// ═══════════════════════════════════════════
// PESQUISA
// ═══════════════════════════════════════════

async function executarPesquisa(q) {
    const dropdown = document.getElementById('search-results-dropdown');
    dropdown.innerHTML = '<p class="search-empty"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</p>';
    dropdown.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}/pesquisar?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error();
        const resultados = await res.json();
        if (resultados.length === 0) {
            dropdown.innerHTML = '<p class="search-empty">Nenhum resultado encontrado.</p>';
            return;
        }
        dropdown.innerHTML = resultados.map(r => {
            const badgeClass = r.tipo === 'usuario' ? 'badge-usuario' : r.tipo === 'publicacao' ? 'badge-publicacao' : 'badge-topico';
            const badgeLabel = r.tipo === 'usuario' ? 'Usuário' : r.tipo === 'publicacao' ? 'Publicação' : 'Fórum';
            return `
                <div class="search-result-item" onclick="handleResultadoPesquisa(${JSON.stringify(r).replace(/"/g, '&quot;')})">
                    <span class="search-result-badge ${badgeClass}">${badgeLabel}</span>
                    <div class="search-result-text">
                        <span class="search-result-title">${r.titulo}</span>
                        <span class="search-result-sub">${r.subtitulo || ''}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch {
        dropdown.innerHTML = '<p class="search-empty">Erro ao buscar. Tente novamente.</p>';
    }
}

window.handleResultadoPesquisa = function(resultado) {
    document.getElementById('search-results-dropdown').classList.add('hidden');
    document.getElementById('search-input').value = '';
    if (resultado.tipo === 'topico_forum') {
        switchAppView('view-forum');
        setTimeout(() => abrirTopico(resultado.id), 200);
    } else if (resultado.tipo === 'publicacao') {
        switchAppView('view-feed');
    }
};

// ═══════════════════════════════════════════
// CONFIGURAÇÕES DA CONTA
// ═══════════════════════════════════════════

function abrirModalConfiguracoes() {
    document.getElementById('settings-form').reset();
    document.getElementById('settings-modal').classList.remove('hidden');
}

window.fecharModalConfiguracoes = function() {
    document.getElementById('settings-modal').classList.add('hidden');
};

async function handleSalvarConfiguracoes(e) {
    e.preventDefault();
    const senhaAtual = document.getElementById('settings-current-pass').value;
    const novoEmail = document.getElementById('settings-new-email').value.trim();
    const novaSenha = document.getElementById('settings-new-pass').value;

    if (!novoEmail && !novaSenha) return showToast('Informe um novo e-mail ou uma nova senha.', 'error');

    const token = sessionStorage.getItem('token_jwt');
    const payload = { senha_atual: senhaAtual };
    if (novoEmail) payload.novo_email = novoEmail;
    if (novaSenha) {
        if (novaSenha.length < 6) return showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
        payload.nova_senha = novaSenha;
    }

    try {
        const res = await fetch(`${API_URL}/configuracoes?token=${token}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Configurações salvas com sucesso!', 'success');
            // Atualiza dados locais do usuário
            if (data.usuario) {
                currentUser = { ...currentUser, ...data.usuario };
                sessionStorage.setItem('ser_sustentavel_session', JSON.stringify(currentUser));
                updateHeader();
            }
            fecharModalConfiguracoes();
        } else {
            showToast(data.detail || 'Erro ao salvar configurações.', 'error');
        }
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}

// ═══════════════════════════════════════════
// AUTENTICAÇÃO
// ═══════════════════════════════════════════

async function handleEditProfileSave() {
    const novoSobreMim = document.getElementById('edit-about').value.trim();
    let caminhoAvatar = currentUser.avatar;

    if (editAvatarFile) {
        const urlUpload = await uploadArquivoParaBackend(editAvatarFile);
        if (urlUpload) caminhoAvatar = urlUpload;
    }

    currentUser.sobre_mim = novoSobreMim;
    currentUser.avatar = caminhoAvatar;
    sessionStorage.setItem('ser_sustentavel_session', JSON.stringify(currentUser));
    showToast('Perfil atualizado!', 'success');
    switchAppView('view-profile');
}

function setupPasswordVisibility(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
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
            body: JSON.stringify({ nome, email, data_nascimento: dob, senha })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Conta criada com sucesso!', 'success');
            document.getElementById('register-form').reset();
            document.getElementById('login-email').value = email;
            showScreen('login-screen');
        } else showToast(data.detail || 'Erro ao cadastrar.', 'error');
    } catch { showToast('Erro de conexão com o servidor.', 'error'); }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const senha = document.getElementById('login-password').value;
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
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
    } catch { showToast('Erro de conexão.', 'error'); }
}

async function handleLogout() {
    const token = sessionStorage.getItem('token_jwt');
    if (token) try { await fetch(`${API_URL}/logout?token=${token}`, { method: 'POST' }); } catch(e) {}
    currentUser = null;
    sessionStorage.removeItem('ser_sustentavel_session');
    sessionStorage.removeItem('token_jwt');
    showScreen('login-screen');
}

function updateHeader() { if (currentUser) document.getElementById('header-username').innerText = currentUser.nome; }

// ═══════════════════════════════════════════
// FEED / POSTS
// ═══════════════════════════════════════════

let selectedFile = null;
function handleFileSelect(e) {
    const file = e.target.files[0];
    const display = document.getElementById('file-name-display');
    if (!file) { display.innerText = "Nenhuma mídia selecionada"; selectedFile = null; return; }
    display.innerText = file.name;
    selectedFile = file;
}

async function handleCreatePost(e) {
    e.preventDefault();
    const content = document.getElementById('post-content').value.trim();
    const token = sessionStorage.getItem('token_jwt');
    if (!content && !selectedFile) return showToast('A publicação não pode estar vazia.', 'error');

    let caminho_seguro_db = "";
    if (selectedFile) {
        caminho_seguro_db = await uploadArquivoParaBackend(selectedFile);
        if (!caminho_seguro_db) return;
    }

    try {
        const response = await fetch(`${API_URL}/postar?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ legenda: content, caminho_foto: caminho_seguro_db })
        });
        if (response.ok) {
            showToast('Ação ecológica publicada! 🌿 +5 Eco-Pontos', 'success');
            document.getElementById('create-post-form').reset();
            document.getElementById('file-name-display').innerText = "Nenhuma mídia selecionada";
            selectedFile = null;
            renderFeed('feed-container', false);
        } else {
            const err = await response.json(); showToast(err.detail, 'error');
        }
    } catch { showToast('Erro de conexão.', 'error'); }
}

async function renderFeed(containerId, apenasUsuarioLogado) {
    const container = document.getElementById(containerId);
    const token = sessionStorage.getItem('token_jwt');
    try {
        const response = await fetch(`${API_URL}/feed?token=${token}`);
        let dbPublicacoes = await response.json();

        if (apenasUsuarioLogado) {
            dbPublicacoes = dbPublicacoes.filter(p => p.autor === currentUser.nome);
        }

        container.innerHTML = '';
        if (dbPublicacoes.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-leaf" style="font-size:2rem;color:var(--accent-mint);margin-bottom:10px;"></i><p>Nenhuma publicação encontrada.</p></div>`;
            return;
        }

        dbPublicacoes.forEach(post => {
            const card = document.createElement('article');
            card.className = 'post-card glass-panel fade-in';

            let mediaHtml = '';
            if (post.caminho_foto && post.caminho_foto.length > 5) {
                const urlCompleta = post.caminho_foto.startsWith('http') ? post.caminho_foto : `${BASE_URL}${post.caminho_foto}`;
                mediaHtml = `<div class="post-media-container"><img src="${urlCompleta}" alt="Mídia da postagem"></div>`;
            }

            const isMe = post.id_autor === currentUser.id_usuario;
            const amIFollowing = listaSeguindo.includes(post.autor);
            const followBtnHtml = isMe ? '' : `<button class="btn-follow ${amIFollowing ? 'following' : ''}" onclick="toggleFollow('${post.autor}')">${amIFollowing ? '<i class="fa-solid fa-check"></i> Seguindo' : 'Seguir'}</button>`;
            const deleteBtn = isMe ? `<button class="btn-delete-post" onclick="abrirModalDeletar(${post.id_postagem})" title="Excluir"><i class="fa-solid fa-trash"></i></button>` : '';

            let commentsHtml = '';
            post.comentarios.forEach(com => {
                const isMyCom = com.id_autor === currentUser.id_usuario;
                const deleteBtnCom = isMyCom ? `<button class="btn-delete-comment" onclick="abrirModalDeletarComentario(${com.id_comentario})" title="Apagar comentário"><i class="fa-solid fa-trash"></i></button>` : '';
                const likeComClass = com.eu_curto ? 'liked' : '';
                commentsHtml += `
                    <div class="comment-item" id="comment-${com.id_comentario}">
                        <div class="comment-header">
                            <span class="comment-author">${com.autor}</span>
                            <div class="comment-meta">
                                <span class="comment-date">${com.data || ''}</span>
                                <div class="comment-actions">
                                    <button class="btn-like-comment ${likeComClass}" onclick="curtirComentario(${com.id_comentario})">
                                        <i class="fa-solid fa-leaf"></i> ${com.total_curtidas}
                                    </button>
                                    ${deleteBtnCom}
                                </div>
                            </div>
                        </div>
                        <p class="comment-text">${com.texto}</p>
                    </div>`;
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
    } catch { container.innerHTML = `<p style="color:var(--danger)">Erro ao carregar o feed.</p>`; }
}

// ═══════════════════════════════════════════
// APAGAR POST
// ═══════════════════════════════════════════

let postParaDeletar = null;

window.abrirModalDeletar = function(idPublicacao) {
    postParaDeletar = idPublicacao;
    document.getElementById('delete-modal').classList.remove('hidden');
};

window.fecharModalDeletar = function() {
    postParaDeletar = null;
    document.getElementById('delete-modal').classList.add('hidden');
};

async function confirmarDeletarPost() {
    if (!postParaDeletar) return;
    const token = sessionStorage.getItem('token_jwt');
    try {
        const response = await fetch(`${API_URL}/postar/${postParaDeletar}?token=${token}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('Publicação excluída!', 'success');
            fecharModalDeletar();
            const isProfileActive = document.getElementById('nav-profile-btn').classList.contains('active');
            renderFeed(isProfileActive ? 'profile-posts-container' : 'feed-container', isProfileActive);
        }
    } catch { showToast('Erro de conexão.', 'error'); fecharModalDeletar(); }
}

// ═══════════════════════════════════════════
// APAGAR COMENTÁRIO
// ═══════════════════════════════════════════

let comentarioParaDeletar = null;

window.abrirModalDeletarComentario = function(idComentario) {
    comentarioParaDeletar = idComentario;
    document.getElementById('delete-comment-modal').classList.remove('hidden');
};

window.fecharModalDeletarComentario = function() {
    comentarioParaDeletar = null;
    document.getElementById('delete-comment-modal').classList.add('hidden');
};

async function confirmarDeletarComentario() {
    if (!comentarioParaDeletar) return;
    const token = sessionStorage.getItem('token_jwt');
    try {
        const response = await fetch(`${API_URL}/comentario/${comentarioParaDeletar}?token=${token}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('Comentário excluído!', 'success');
            fecharModalDeletarComentario();
            const isProfileActive = document.getElementById('nav-profile-btn').classList.contains('active');
            renderFeed(isProfileActive ? 'profile-posts-container' : 'feed-container', isProfileActive);
        } else {
            const err = await response.json();
            showToast(err.detail || 'Erro ao excluir.', 'error');
            fecharModalDeletarComentario();
        }
    } catch { showToast('Erro de conexão.', 'error'); fecharModalDeletarComentario(); }
}

// ═══════════════════════════════════════════
// CURTIR / COMENTAR POSTAGEM
// ═══════════════════════════════════════════

window.toggleLike = async function(idPublicacao) {
    const token = sessionStorage.getItem('token_jwt');
    try {
        const response = await fetch(`${API_URL}/curtir/${idPublicacao}?token=${token}`, { method: 'POST' });
        if (response.ok) {
            const isProfileActive = document.getElementById('nav-profile-btn').classList.contains('active');
            renderFeed(isProfileActive ? 'profile-posts-container' : 'feed-container', isProfileActive);
        }
    } catch { showToast('Erro ao processar curtida.', 'error'); }
};

window.toggleCommentBox = function(idPublicacao) {
    document.getElementById(`comment-box-${idPublicacao}`).classList.toggle('hidden');
};

window.addComment = async function(idPublicacao) {
    const input = document.getElementById(`comment-input-${idPublicacao}`);
    const texto = input.value.trim();
    const token = sessionStorage.getItem('token_jwt');
    if (!texto) return;
    try {
        const response = await fetch(`${API_URL}/comentar/${idPublicacao}?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto })
        });
        if (response.ok) {
            input.value = '';
            const isProfileActive = document.getElementById('nav-profile-btn').classList.contains('active');
            renderFeed(isProfileActive ? 'profile-posts-container' : 'feed-container', isProfileActive);
        }
    } catch { showToast('Erro de conexão.', 'error'); }
};

// ═══════════════════════════════════════════
// CURTIR COMENTÁRIO DE POSTAGEM
// ═══════════════════════════════════════════

window.curtirComentario = async function(idComentario) {
    const token = sessionStorage.getItem('token_jwt');
    try {
        const res = await fetch(`${API_URL}/curtir-comentario/${idComentario}?token=${token}`, { method: 'POST' });
        if (res.ok) {
            const isProfileActive = document.getElementById('nav-profile-btn').classList.contains('active');
            renderFeed(isProfileActive ? 'profile-posts-container' : 'feed-container', isProfileActive);
        }
    } catch { showToast('Erro ao curtir comentário.', 'error'); }
};

// ═══════════════════════════════════════════
// FÓRUM
// ═══════════════════════════════════════════

function mostrarListaForum() {
    document.getElementById('forum-list-panel').classList.remove('hidden');
    document.getElementById('forum-topic-detail').classList.add('hidden');
}

function mostrarDetalheTopico() {
    document.getElementById('forum-list-panel').classList.add('hidden');
    document.getElementById('forum-topic-detail').classList.remove('hidden');
}

async function carregarTopicos() {
    const container = document.getElementById('forum-container');
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>';
    try {
        const res = await fetch(`${API_URL}/forum`);
        const topicos = await res.json();
        if (topicos.length === 0) {
            container.innerHTML = '<div class="empty-state">O fórum está vazio. Comece o debate!</div>';
            return;
        }
        container.innerHTML = topicos.map(t => {
            const isMe = t.id_autor === currentUser.id_usuario;
            const deleteBtn = isMe ? `<button class="btn-delete-post" onclick="event.stopPropagation();abrirModalDeletarTopico(${t.id_topico})" title="Excluir tópico"><i class="fa-solid fa-trash"></i></button>` : '';
            return `
                <div class="post-card glass-panel fade-in forum-topic-clickable" onclick="abrirTopico(${t.id_topico})">
                    <div class="post-header">
                        <div class="post-author">
                            <h4 style="color:var(--accent-mint);margin:0;">${t.titulo}</h4>
                            <span class="post-date">Por ${t.autor} em ${t.data_criacao}</span>
                        </div>
                        ${deleteBtn}
                    </div>
                    <p style="font-size:0.9rem;color:var(--text-muted);">${t.conteudo.length > 120 ? t.conteudo.substring(0, 120) + '...' : t.conteudo}</p>
                    <div class="forum-topic-footer">
                        <span style="font-size:0.8rem;color:var(--text-muted);"><i class="fa-regular fa-comment"></i> ${t.total_comentarios} comentário(s)</span>
                        <span style="font-size:0.8rem;color:var(--accent-mint);">Ver tópico →</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch {
        container.innerHTML = '<div class="empty-state">Erro ao carregar o fórum.</div>';
    }
}

window.abrirTopico = async function(idTopico) {
    topicoAtualId = idTopico;
    mostrarDetalheTopico();
    const token = sessionStorage.getItem('token_jwt');
    try {
        const res = await fetch(`${API_URL}/forum/${idTopico}/comentarios?token=${token}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        // Renderiza o conteúdo do tópico
        const isMe = data.id_autor === currentUser.id_usuario;
        const deleteBtn = isMe ? `<button class="btn-delete-post" onclick="abrirModalDeletarTopico(${data.id_topico})" title="Excluir tópico"><i class="fa-solid fa-trash"></i></button>` : '';
        document.getElementById('forum-topic-content').innerHTML = `
            <div class="post-header">
                <div class="post-author">
                    <h3 style="color:var(--accent-mint);margin:0;">${data.titulo}</h3>
                    <span class="post-date">Por ${data.autor} em ${data.data_criacao}</span>
                </div>
                ${deleteBtn}
            </div>
            <p style="font-size:0.95rem;line-height:1.6;">${data.conteudo}</p>
        `;

        // Renderiza comentários do tópico
        const commentsContainer = document.getElementById('forum-comments-list');
        if (data.comentarios.length === 0) {
            commentsContainer.innerHTML = '<div class="empty-state">Nenhum comentário ainda. Seja o primeiro!</div>';
        } else {
            commentsContainer.innerHTML = data.comentarios.map(c => {
                const isMyCom = c.id_autor === currentUser.id_usuario;
                const deleteComBtn = isMyCom ? `<button class="btn-delete-comment" onclick="abrirModalDeletarComentarioForum(${c.id_comentario_forum})" title="Apagar"><i class="fa-solid fa-trash"></i></button>` : '';
                const likeClass = c.eu_curto ? 'liked' : '';
                return `
                    <div class="post-card glass-panel fade-in" id="forum-com-${c.id_comentario_forum}">
                        <div class="comment-header">
                            <span class="comment-author">${c.autor}</span>
                            <div class="comment-meta">
                                <span class="comment-date">${c.data || ''}</span>
                                <div class="comment-actions">
                                    <button class="btn-like-comment ${likeClass}" onclick="curtirComentarioForum(${c.id_comentario_forum})">
                                        <i class="fa-solid fa-leaf"></i> ${c.total_curtidas}
                                    </button>
                                    ${deleteComBtn}
                                </div>
                            </div>
                        </div>
                        <p class="comment-text">${c.texto}</p>
                    </div>
                `;
            }).join('');
        }
    } catch {
        showToast('Erro ao carregar o tópico.', 'error');
    }
};

async function handleCreateForumTopic(e) {
    e.preventDefault();
    const titulo = document.getElementById('topic-title').value.trim();
    const conteudo = document.getElementById('topic-content').value.trim();
    if (!titulo || !conteudo) return showToast('Preencha título e conteúdo.', 'error');
    const token = sessionStorage.getItem('token_jwt');
    try {
        const res = await fetch(`${API_URL}/forum?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo, conteudo })
        });
        if (res.ok) {
            showToast('Tópico criado! +5 Eco-Pontos', 'success');
            document.getElementById('create-topic-form').reset();
            carregarTopicos();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Erro ao criar tópico.', 'error');
        }
    } catch { showToast('Erro de conexão.', 'error'); }
}

async function handleForumComment(e) {
    e.preventDefault();
    if (!topicoAtualId) return;
    const texto = document.getElementById('forum-comment-input').value.trim();
    if (!texto) return;
    const token = sessionStorage.getItem('token_jwt');
    try {
        const res = await fetch(`${API_URL}/forum/${topicoAtualId}/comentarios?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto })
        });
        if (res.ok) {
            document.getElementById('forum-comment-input').value = '';
            showToast('Comentário publicado! +3 Eco-Pontos', 'success');
            abrirTopico(topicoAtualId); // Recarrega
        } else {
            const err = await res.json();
            showToast(err.detail || 'Erro ao comentar.', 'error');
        }
    } catch { showToast('Erro de conexão.', 'error'); }
}

// ─── Excluir tópico do fórum ───
let topicoParaDeletar = null;

window.abrirModalDeletarTopico = function(idTopico) {
    topicoParaDeletar = idTopico;
    // Reutiliza o modal de deletar post
    document.querySelector('#delete-modal h3').innerText = '⚠️ Apagar Tópico';
    document.querySelector('#delete-modal p').innerText = 'Tem certeza que deseja apagar este tópico? Todos os comentários serão perdidos.';
    // Temporariamente substitui o listener
    const confirmBtn = document.getElementById('btn-confirm-delete');
    confirmBtn.onclick = confirmarDeletarTopico;
    document.getElementById('delete-modal').classList.remove('hidden');
};

async function confirmarDeletarTopico() {
    if (!topicoParaDeletar) return;
    const token = sessionStorage.getItem('token_jwt');
    try {
        const res = await fetch(`${API_URL}/forum/${topicoParaDeletar}?token=${token}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Tópico excluído!', 'success');
            topicoParaDeletar = null;
            fecharModalDeletar();
            // Restaura o comportamento original do botão
            document.getElementById('btn-confirm-delete').onclick = confirmarDeletarPost;
            document.querySelector('#delete-modal h3').innerText = '⚠️ Apagar Publicação';
            document.querySelector('#delete-modal p').innerText = 'Tem certeza que deseja apagar este post? Esta ação não pode ser desfeita.';
            mostrarListaForum();
            carregarTopicos();
        }
    } catch { showToast('Erro de conexão.', 'error'); fecharModalDeletar(); }
}

// ─── Excluir comentário do fórum ───
let commentForumParaDeletar = null;

window.abrirModalDeletarComentarioForum = function(idComentarioForum) {
    commentForumParaDeletar = idComentarioForum;
    document.getElementById('delete-comment-modal').classList.remove('hidden');
    // Substitui o listener do botão de confirmação
    document.getElementById('btn-confirm-delete-comment').onclick = confirmarDeletarComentarioForum;
};

async function confirmarDeletarComentarioForum() {
    if (!commentForumParaDeletar) return;
    const token = sessionStorage.getItem('token_jwt');
    try {
        const res = await fetch(`${API_URL}/forum/comentario/${commentForumParaDeletar}?token=${token}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Comentário excluído!', 'success');
            commentForumParaDeletar = null;
            fecharModalDeletarComentario();
            // Restaura o listener original
            document.getElementById('btn-confirm-delete-comment').onclick = confirmarDeletarComentario;
            if (topicoAtualId) abrirTopico(topicoAtualId);
        }
    } catch { showToast('Erro de conexão.', 'error'); fecharModalDeletarComentario(); }
}

// ─── Curtir comentário do fórum ───
window.curtirComentarioForum = async function(idComentarioForum) {
    const token = sessionStorage.getItem('token_jwt');
    try {
        const res = await fetch(`${API_URL}/forum/curtir-comentario/${idComentarioForum}?token=${token}`, { method: 'POST' });
        if (res.ok && topicoAtualId) abrirTopico(topicoAtualId);
    } catch { showToast('Erro ao curtir comentário.', 'error'); }
};

// ═══════════════════════════════════════════
// HÁBITOS
// ═══════════════════════════════════════════

window.registerHabit = function(nomeHabito) {
    const dbHabitos = JSON.parse(localStorage.getItem('serSustentavel_habitos') || '[]');
    dbHabitos.unshift({ id_usuario: currentUser.id_usuario, habito: nomeHabito, data: new Date().toISOString() });
    localStorage.setItem('serSustentavel_habitos', JSON.stringify(dbHabitos));
    showToast(`Hábito '${nomeHabito}' registrado! +10 Eco-Pontos`, 'success');
    renderHabitsLog();
};

function renderHabitsLog() {
    const container = document.getElementById('habits-log-container');
    const dbHabitos = JSON.parse(localStorage.getItem('serSustentavel_habitos') || '[]');
    const meusHabitos = dbHabitos.filter(h => h.id_usuario === currentUser.id_usuario).slice(0, 5);
    if (meusHabitos.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Nenhum hábito registrado recentemente.</p>';
        return;
    }
    container.innerHTML = meusHabitos.map(h => `<div class="habit-log-item"><span>${h.habito}</span> ${formatarData(h.data, true)}</div>`).join('');
}

// ═══════════════════════════════════════════
// SEGUIR
// ═══════════════════════════════════════════

let listaSeguindo = [];
function atualizarListaSeguidores() {
    const dbSeguidores = JSON.parse(localStorage.getItem('serSustentavel_seguidores') || '{}');
    if (!dbSeguidores[currentUser.id_usuario]) dbSeguidores[currentUser.id_usuario] = [];
    listaSeguindo = dbSeguidores[currentUser.id_usuario];
    if (document.getElementById('stat-followers')) document.getElementById('stat-followers').innerText = listaSeguindo.length;
}

window.toggleFollow = function(nomeAutor) {
    const dbSeguidores = JSON.parse(localStorage.getItem('serSustentavel_seguidores') || '{}');
    if (!dbSeguidores[currentUser.id_usuario]) dbSeguidores[currentUser.id_usuario] = [];
    let meusSeguidos = dbSeguidores[currentUser.id_usuario];
    if (meusSeguidos.includes(nomeAutor)) {
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
};

// ═══════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════

function formatarData(isoString, comHora = false) {
    if (!isoString) return '';
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
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle" style="color:var(--accent-emerald)"></i>' : '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}