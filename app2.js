/**
 * app.js
 * ======
 * YouTube 구독 피드 갤러리 메인 애플리케이션
 * RSS 피드를 통해 각 채널의 최신 영상을 가져와 카드 형태로 표시합니다.
 */

(function () {
    'use strict';

    // ============================
    // Constants
    // ============================
    const STORAGE_KEY = typeof CHANNELS_ALGORITHM !== 'undefined' ? 'yt_feed_channels_algo' :
                        (typeof CHANNELS_1000 !== 'undefined' ? 'yt_feed_channels_1000' : 'yt_feed_channels');
    const CACHE_KEY = 'yt_feed_cache_v2';
    const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간
    const CORS_PROXIES = [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ];
    const RSS_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
    const MAX_VIDEOS_PER_CHANNEL = 1;

    // ============================
    // DOM Elements
    // ============================
    const videoGrid = document.getElementById('video-grid');
    const loadingEl = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const settingsModal = document.getElementById('settings-modal');
    const btnSettings = document.getElementById('btn-settings');
    const btnRefresh = document.getElementById('btn-refresh');
    const modalClose = document.getElementById('modal-close');
    const channelListEl = document.getElementById('channel-list');
    const btnAddChannel = document.getElementById('btn-add-channel');
    const btnSave = document.getElementById('btn-save-settings');
    const inputName = document.getElementById('new-channel-name');
    const inputId = document.getElementById('new-channel-id');
    const toastEl = document.getElementById('toast');
    const navContainer = document.querySelector('.nav');
    const filterAllBtn = document.getElementById('filter-all');
    const sortSelect = document.getElementById('sort-select');
    const btnPlaylist = document.getElementById('btn-playlist');
    const playlistModal = document.getElementById('playlist-modal');
    const playlistModalClose = document.getElementById('playlist-modal-close');
    const playlistLinks = document.getElementById('playlist-links');

    // ============================
    // State
    // ============================
    const defaultChannels = typeof DEFAULT_CHANNELS !== 'undefined' ? DEFAULT_CHANNELS : 
                            (typeof CHANNELS_ALGORITHM !== 'undefined' ? CHANNELS_ALGORITHM :
                            (typeof CHANNELS_1000 !== 'undefined' ? CHANNELS_1000 : []));
    let channels = [];
    let allVideos = [];
    let activeFilter = 'all';
    let activeCategory = 'all';
    let activeSort = 'latest';
    let tempChannels = []; // for modal editing

    // ============================
    // Initialize
    // ============================
    function init() {
        loadChannels();
        setupEventListeners();
        loadFromCache();
    }

    // ============================
    // Channel Management
    // ============================
    function loadChannels() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                channels = JSON.parse(stored);
                // 새로 가져온 채널 개수가 훨씬 많으면(대량 업데이트 시) 덮어쓰기
                if (defaultChannels.length > channels.length + 10) {
                    channels = [...defaultChannels];
                    saveChannels();
                }
            } catch (e) {
                channels = [...defaultChannels];
            }
        } else {
            channels = [...defaultChannels];
        }
    }

    function saveChannels() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
    }

    function loadFromCache() {
        if (typeof CACHED_VIDEOS === 'undefined' || CACHED_VIDEOS.length === 0) {
            showLoading(false);
            showEmpty(true);
            return;
        }

        allVideos = CACHED_VIDEOS.map(v => ({
            ...v,
            published: new Date(v.published)
        }));

        showLoading(false);
        showEmpty(false);
        buildFilterButtons();
        buildCategoryFilters();
        renderVideos();
    }

    // ============================
    // Rendering
    // ============================
    function renderVideos() {
        videoGrid.innerHTML = '';

        let filtered = allVideos;
        
        if (activeCategory !== 'all') {
            const categoryChannelIds = channels.filter(c => c.category === activeCategory).map(c => c.id);
            filtered = filtered.filter(v => categoryChannelIds.includes(v.channelId));
        } else if (activeFilter !== 'all') {
            filtered = filtered.filter(v => v.channelId === activeFilter);
        } else {
            // "모두보기"
            const currentChannelIds = channels.map(c => c.id);
            filtered = filtered.filter(v => currentChannelIds.includes(v.channelId));
        }

        // 정렬 로직 적용
        if (activeSort === 'latest') {
            filtered.sort((a, b) => b.published - a.published);
        } else if (activeSort === 'views') {
            filtered.sort((a, b) => b.views - a.views);
        } else if (activeSort === 'name') {
            filtered.sort((a, b) => a.title.localeCompare(b.title));
        }

        filtered.forEach((video, idx) => {
            const card = createVideoCard(video, idx);
            videoGrid.appendChild(card);
        });
    }

    function createVideoCard(video, index) {
        const card = document.createElement('article');
        card.className = 'video-card';
        card.style.animationDelay = `${index * 0.05}s`;
        card.setAttribute('data-channel', video.channelId);

        const isNew = isRecent(video.published, 24);
        const timeAgo = getTimeAgo(video.published);
        const viewsFormatted = formatViews(video.views);
        const initial = video.channelName.charAt(0);
        const avatarHtml = video.channelAvatar 
            ? `<img src="${video.channelAvatar}" alt="${escapeHtml(video.channelName)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
            : initial;

        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy"
                     onerror="this.src='https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg'">
                <div class="card-play-btn">
                    <svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg>
                </div>
            </div>
            <div class="card-body">
                <div class="channel-avatar">${avatarHtml}</div>
                <div class="card-text">
                    <h3 class="card-title">${escapeHtml(video.title)}</h3>
                    <div class="card-subtitle">
                        <span class="channel-name">${escapeHtml(video.channelName)}</span>
                        <span class="meta-separator">•</span>
                        <div class="card-meta">
                            <span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                ${timeAgo}
                            </span>
                            ${video.views > 0 ? `
                            <span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                ${viewsFormatted}
                            </span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            window.open(video.url, '_blank', 'noopener,noreferrer');
        });

        return card;
    }

    function buildFilterButtons() {
        // Remove existing dynamic buttons
        if (navContainer) {
            navContainer.querySelectorAll('.nav-btn:not([data-filter="all"])').forEach(el => el.remove());
        }
        // Get unique channels from loaded videos
        const channelsInVideos = new Map();
        allVideos.forEach(v => {
            if (!channelsInVideos.has(v.channelId)) {
                channelsInVideos.set(v.channelId, v.channelName);
            }
        });

        channelsInVideos.forEach((name, id) => {
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.setAttribute('data-filter', id);
            btn.textContent = name;
            btn.addEventListener('click', () => setFilter(id, btn));
            if (navContainer) navContainer.appendChild(btn);
        });
    }

    function buildCategoryFilters() {
        const catContainer = document.getElementById('category-filters');
        if (!catContainer) return;

        const categories = new Set();
        channels.forEach(c => {
            if (c.category) categories.add(c.category);
        });

        if (categories.size === 0) {
            catContainer.style.display = 'none';
            return;
        }

        catContainer.innerHTML = '';
        
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn active';
        allBtn.textContent = '전체 보기';
        allBtn.addEventListener('click', () => setCategoryFilter('all', allBtn));
        catContainer.appendChild(allBtn);

        Array.from(categories).sort().forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = cat;
            btn.addEventListener('click', () => setCategoryFilter(cat, btn));
            catContainer.appendChild(btn);
        });
    }

    function setCategoryFilter(cat, btnEl) {
        activeCategory = cat;
        activeFilter = 'all'; // reset channel filter
        const catContainer = document.getElementById('category-filters');
        if (catContainer) {
            catContainer.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
        }
        if (btnEl) btnEl.classList.add('active');
        
        if (navContainer) {
            navContainer.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            if (filterAllBtn) filterAllBtn.classList.add('active');
        }

        renderVideos();
    }

    function setFilter(filter, btnEl) {
        activeFilter = filter;
        activeCategory = 'all'; // reset category filter

        const catContainer = document.getElementById('category-filters');
        if (catContainer) {
            catContainer.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            const allBtn = catContainer.querySelector('.category-btn'); // first child is ALL
            if (allBtn) allBtn.classList.add('active');
        }

        // Update active state
        if (navContainer) navContainer.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if (btnEl) {
            btnEl.classList.add('active');
        } else {
            if (filterAllBtn) filterAllBtn.classList.add('active');
        }

        renderVideos();
    }

    // ============================
    // Settings Modal
    // ============================
    function openSettings() {
        tempChannels = JSON.parse(JSON.stringify(channels));
        renderChannelList();
        settingsModal.classList.add('open');
    }

    function closeSettings() {
        settingsModal.classList.remove('open');
    }

    function renderChannelList() {
        channelListEl.innerHTML = '';
        tempChannels.forEach((ch, idx) => {
            const item = document.createElement('div');
            item.className = 'channel-item';
            item.innerHTML = `
                <div class="channel-avatar" style="width:32px;height:32px;font-size:0.75rem;">${ch.name.charAt(0)}</div>
                <div class="channel-item-info">
                    <div class="channel-item-name">${escapeHtml(ch.name)}</div>
                    <div class="channel-item-id">${ch.id}</div>
                </div>
                <button class="btn-remove" data-index="${idx}" title="삭제">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            `;
            channelListEl.appendChild(item);
        });

        // Add remove event listeners
        channelListEl.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'));
                tempChannels.splice(idx, 1);
                renderChannelList();
            });
        });
    }

    function addChannel() {
        const name = inputName.value.trim();
        const id = inputId.value.trim();

        if (!name || !id) {
            showToast('채널 이름과 ID를 모두 입력해주세요');
            return;
        }

        if (!/^UC[\w-]{22}$/.test(id)) {
            showToast('올바른 채널 ID 형식이 아닙니다 (UC로 시작하는 24자)');
            return;
        }

        if (tempChannels.some(ch => ch.id === id)) {
            showToast('이미 추가된 채널입니다');
            return;
        }

        tempChannels.push({ name, id });
        inputName.value = '';
        inputId.value = '';
        renderChannelList();
        showToast(`${name} 채널이 추가되었습니다`);
    }

    function saveSettings() {
        channels = [...tempChannels];
        saveChannels();
        closeSettings();
        activeFilter = 'all';
        if (filterAllBtn) filterAllBtn.classList.add('active');
        loadFromCache();
        showToast('설정이 저장되었습니다');
    }

    // ============================
    // Playlist Modal
    // ============================
    function openPlaylistModal() {
        playlistLinks.innerHTML = '';
        const filtered = activeFilter === 'all'
            ? [...allVideos]
            : allVideos.filter(v => v.channelId === activeFilter);
        
        // 정렬
        if (activeSort === 'latest') {
            filtered.sort((a, b) => b.published - a.published);
        } else if (activeSort === 'views') {
            filtered.sort((a, b) => b.views - a.views);
        } else if (activeSort === 'name') {
            filtered.sort((a, b) => a.title.localeCompare(b.title));
        }

        if (filtered.length === 0) {
            showToast('생성할 영상이 없습니다.');
            return;
        }

        const CHUNK_SIZE = 50;
        for (let i = 0; i < filtered.length; i += CHUNK_SIZE) {
            const chunk = filtered.slice(i, i + CHUNK_SIZE);
            const start = i + 1;
            const end = i + chunk.length;
            
            const ids = chunk.map(v => v.videoId).join(',');
            const url = `https://www.youtube.com/watch_videos?video_ids=${ids}`;
            
            const btn = document.createElement('button');
            btn.className = 'btn-save'; // 재사용 (보라색 그라데이션)
            btn.style.marginBottom = '10px';
            btn.textContent = `${start}위 ~ ${end}위 묶어서 연속 재생하기`;
            btn.addEventListener('click', () => {
                window.open(url, '_blank');
            });
            playlistLinks.appendChild(btn);
        }
        playlistModal.classList.add('open');
    }

    function closePlaylistModal() {
        playlistModal.classList.remove('open');
    }

    // ============================
    // UI Helpers
    // ============================
    function showLoading(show) {
        if (show) {
            loadingEl.classList.remove('hidden');
        } else {
            loadingEl.classList.add('hidden');
        }
    }

    function showEmpty(show) {
        emptyState.style.display = show ? 'flex' : 'none';
    }

    function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.add('visible');
        setTimeout(() => {
            toastEl.classList.remove('visible');
        }, 3000);
    }

    // ============================
    // Utility Functions
    // ============================
    function isRecent(date, hours) {
        const diff = Date.now() - date.getTime();
        return diff < hours * 60 * 60 * 1000;
    }

    function getTimeAgo(date) {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

        if (seconds < 60) return '방금 전';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
        if (seconds < 2592000) return `${Math.floor(seconds / 604800)}주 전`;
        if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}개월 전`;
        return `${Math.floor(seconds / 31536000)}년 전`;
    }

    function formatViews(views) {
        if (views >= 100000000) return `${(views / 100000000).toFixed(1)}억회`;
        if (views >= 10000) return `${(views / 10000).toFixed(1)}만회`;
        if (views >= 1000) return `${(views / 1000).toFixed(1)}천회`;
        return `${views}회`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================
    // Event Listeners
    // ============================
    function setupEventListeners() {
        btnSettings.addEventListener('click', openSettings);
        modalClose.addEventListener('click', closeSettings);
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettings();
        });

        btnPlaylist.addEventListener('click', openPlaylistModal);
        playlistModalClose.addEventListener('click', closePlaylistModal);
        playlistModal.addEventListener('click', (e) => {
            if (e.target === playlistModal) closePlaylistModal();
        });

        btnAddChannel.addEventListener('click', addChannel);
        btnSave.addEventListener('click', saveSettings);

        btnRefresh.addEventListener('click', () => {
            btnRefresh.classList.add('spinning');
            setTimeout(() => {
                location.reload();
            }, 300);
        });

        if (filterAllBtn) filterAllBtn.addEventListener('click', () => setFilter('all', filterAllBtn));

        sortSelect.addEventListener('change', (e) => {
            activeSort = e.target.value;
            renderVideos();
        });

        // Enter key in inputs
        inputId.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addChannel();
        });
        inputName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') inputId.focus();
        });

        // Escape key closes modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSettings();
        });
    }

    // ============================
    // Start
    // ============================
    document.addEventListener('DOMContentLoaded', init);
})();
