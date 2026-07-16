
        let tvShopId = '';
        const match = window.location.pathname.match(/\/tv-([^\/]+)/);
        if (match) {
            tvShopId = match[1];
        }
        const shopQuery = tvShopId ? `&shopId=${tvShopId}` : '';
        const shopQueryQ = tvShopId ? `?shopId=${tvShopId}` : '';

        function updateClock() {
            const now = new Date();
            document.getElementById('clock').innerText = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        setInterval(updateClock, 1000);
        updateClock();

        let ws;

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(`${protocol}//${window.location.host}/ws?tv=true${shopQuery}`);

            ws.onopen = function() {
                document.getElementById('clock').style.color = '#4CAF50'; // Green clock when connected
            };

            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    if (Array.isArray(data)) {
                        renderOrders(data);
                    }
                } catch(e) { console.error("WebSocket Message Error:", e); }
            };

            ws.onclose = function() {
                document.getElementById('clock').style.color = '#F44336'; // Red clock when disconnected
                setTimeout(connectWebSocket, 3000);
            };
        }

        let screensaverMode = 'dvd';
        let dvdAnimId = null;
        let isCurrentlyIdle = true;
        let x = 100, y = 100, dx = 3, dy = 3;
        const colors = ['#D84315', '#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0'];
        let colorIdx = 0;

        function startDvd() {
            if (dvdAnimId) return;
            const dvd = document.getElementById('dvdLogo');
            function animate() {
                const rect = dvd.getBoundingClientRect();
                if (x + rect.width >= window.innerWidth || x <= 0) {
                    dx = -dx;
                    colorIdx = (colorIdx + 1) % colors.length;
                    dvd.style.color = colors[colorIdx];
                }
                if (y + rect.height >= window.innerHeight || y <= 0) {
                    dy = -dy;
                    colorIdx = (colorIdx + 1) % colors.length;
                    dvd.style.color = colors[colorIdx];
                }
                x += dx;
                y += dy;
                dvd.style.left = x + 'px';
                dvd.style.top = y + 'px';
                dvdAnimId = requestAnimationFrame(animate);
            }
            dvdAnimId = requestAnimationFrame(animate);
        }

        function stopDvd() {
            if (dvdAnimId) {
                cancelAnimationFrame(dvdAnimId);
                dvdAnimId = null;
            }
        }

        function manageScreensaver(isIdle) {
            isCurrentlyIdle = isIdle;
            const body = document.body;
            const dvd = document.getElementById('dvdLogo');
            const emptyText = document.getElementById('emptyState');
            
            if (isIdle) {
                body.classList.remove('idle-glow', 'idle-spotify', 'idle-black');
                
                if (screensaverMode === 'glow') {
                    body.classList.add('idle-glow');
                    dvd.style.display = 'none';
                    stopDvd();
                    emptyText.style.display = 'block';
                } else if (screensaverMode === 'spotify') {
                    body.classList.add('idle-spotify');
                    dvd.style.display = 'none';
                    stopDvd();
                    emptyText.style.display = 'block'; // Spotify fullscreen CSS will hide it
                } else if (screensaverMode === 'off') {
                    body.classList.add('idle-off');
                    dvd.style.display = 'none';
                    stopDvd();
                    emptyText.style.display = 'block';
                } else {
                    // dvd mode default
                    emptyText.style.display = 'none';
                    if (dvd.style.display !== 'block') {
                        dvd.style.display = 'block';
                        startDvd();
                    }
                }
            } else {
                body.classList.remove('idle-glow', 'idle-spotify', 'idle-black');
                dvd.style.display = 'none';
                stopDvd();
                emptyText.style.display = 'none';
            }
        }

        function renderOrders(orders) {
            const grid = document.getElementById('ordersGrid');
            const emptyState = document.getElementById('emptyState');
            
            grid.innerHTML = '';

            if (!orders || orders.length === 0) {
                manageScreensaver(true);
                return;
            }

            manageScreensaver(false);

            // Masonry layout calculation
            const containerWidth = grid.offsetWidth || window.innerWidth;
            let numCols = Math.floor(containerWidth / 260);
            if (numCols < 1) numCols = 1;

            const cols = [];
            for (let i = 0; i < numCols; i++) {
                let col = document.createElement('div');
                col.className = 'masonry-col';
                grid.appendChild(col);
                cols.push(col);
            }

            orders.forEach(order => {
                const card = document.createElement('div');
                card.className = 'order-card';
                if (order.color) {
                    card.style.borderColor = order.color;
                }

                let itemsHtml = '';
                if(order.items) {
                    const grouped = {};
                    order.items.forEach(item => {
                        const key = `${item.name}_${item.portion}_${item.notes || ''}`;
                        if (!grouped[key]) {
                            grouped[key] = { count: 0, item: item };
                        }
                        grouped[key].count++;
                    });
                    
                    Object.values(grouped).forEach(g => {
                        const item = g.item;
                        const count = g.count;
                        let isNew = item.notes && item.notes.includes('[YENİ]');
                        let displayNotes = item.notes ? item.notes.replace('[YENİ]', '').trim() : '';
                        let notlar = displayNotes ? `<div class="item-notes">${displayNotes}</div>` : '';
                        let prefix = count > 1 ? `${count}x ` : '';
                        let porsiyonStr = (item.portion && item.portion !== 'Standart') ? ` <span style="color:#aaa; font-size:16px;">(${item.portion})</span>` : '';
                        
                        let categoryClass = '';
                        let catColor = '#555';
                        const nameLower = item.name.toLowerCase();
                        if (/\b(tavuk|biga|hatay)\b/i.test(nameLower)) {
                            categoryClass = ' chicken';
                            catColor = '#03A9F4';
                        } else if (/\b(kola|ayran|su|soda|sprite|fanta|salgam|şalgam|zero)\b/i.test(nameLower)) {
                            categoryClass = ' drink';
                            catColor = '#8BC34A';
                        }
                        
                        let highlightStyle = isNew ? ` animation: pulseNew 1.5s infinite; border: 2px solid ${catColor}; border-left-width: 5px;` : '';
                        let newBadge = isNew ? ` <span style="color:${catColor}; font-size: 14px; font-weight: 900;">(YENİ)</span>` : '';
                        
                        itemsHtml += `
                            <div class="item${categoryClass}" style="${highlightStyle}">
                                <div class="item-name">${prefix}${item.name}${porsiyonStr}${newBadge}</div>
                                ${notlar}
                            </div>
                        `;
                    });
                }

                let titlePrefix = order.status === 'prepared' ? '<span style="color:#4CAF50; font-weight:bold; margin-right:8px;">✔</span>' : '';

                let orderBodyHtml = '';
                if (order.status !== 'prepared') {
                    let displayNote = order.order_note || '';
                    orderBodyHtml = `
                        ${displayNote ? `<div style="color:#ff5252; font-weight:bold; font-size:16px; margin-bottom:10px; white-space: pre-wrap; text-align: left;">${displayNote}</div>` : ''}
                        <div class="item-list">
                            ${itemsHtml}
                        </div>
                    `;
                }

                let titleName = order.customer_name || '';
                titleName = titleName
                    .replace(/\bCaddesi\b|\bCadde\b/gi, 'Cad.')
                    .replace(/\bSokağı\b|\bSokak\b/gi, 'Skk.')
                    .replace(/\bNo\b/gi, 'N:')
                    .replace(/\bDaire\b/gi, 'D:')
                    .replace(/\bKat\b/gi, 'K:')
                    .replace(/\bMahallesi\b|\bMahalle\b|\bMah\b/gi, 'Mh.');

                card.innerHTML = `
                    <div class="order-header" ${order.status === 'prepared' ? 'style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;"' : ''}>
                        <div class="order-title">${titlePrefix}${titleName} ${order.is_updated ? '<span style="font-size: 0.6em; color: #FF9800;">(Eklendi)</span>' : ''}</div>
                        <div class="order-time">${order.total_amount ? `<span style="margin-right: 12px; color: #4CAF50;">${order.total_amount}₺</span>` : ''}${order.time || ''}</div>
                    </div>
                    ${orderBodyHtml}
                `;
                
                // Find shortest column and append
                let shortestCol = cols[0];
                let minHeight = shortestCol.offsetHeight;
                
                for (let i = 1; i < numCols; i++) {
                    if (cols[i].offsetHeight < minHeight) {
                        minHeight = cols[i].offsetHeight;
                        shortestCol = cols[i];
                    }
                }
                shortestCol.appendChild(card);
            });
        }

        connectWebSocket();

        let currentSpotifyToken = "";
        let playerReady = false;
        let spotifyPlayer = null;
        let spotifyPaused = true;
        let spotifyPosition = 0;
        let spotifyDuration = 0;
        let lastSpotifyUpdate = 0;
        let currentTrackUri = null;

        function formatTime(ms) {
            const totalSec = Math.floor(ms / 1000);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            return m + ":" + (s < 10 ? "0" : "") + s;
        }

        setInterval(() => {
            if (!document.body.classList.contains('idle-spotify')) return;
            if (spotifyDuration === 0) return;
            
            let curPos = spotifyPaused ? spotifyPosition : spotifyPosition + (Date.now() - lastSpotifyUpdate);
            if (curPos > spotifyDuration) curPos = spotifyDuration;
            
            document.getElementById("spFsTimePos").innerText = formatTime(curPos);
            document.getElementById("spFsTimeDur").innerText = formatTime(spotifyDuration);
            
            const pct = (curPos / spotifyDuration) * 100;
            document.getElementById("spFsBarFg").style.width = pct + "%";
        }, 100);

        window.onSpotifyWebPlaybackSDKReady = () => {
            playerReady = true;
            initSpotifyPlayer();
        };

        function initSpotifyPlayer() {
            if (!playerReady || !currentSpotifyToken || spotifyPlayer) return;

            spotifyPlayer = new Spotify.Player({
                name: 'SARACOGLU Mutfak',
                getOAuthToken: cb => { cb(currentSpotifyToken); },
                volume: 0.5
            });

            spotifyPlayer.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                document.getElementById("spTitle").innerText = "Baglandi!";
                document.getElementById("spArtist").innerText = "Muzik acabilirsiniz";
            });

            spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
            });

            spotifyPlayer.addListener('initialization_error', ({ message }) => { console.error('Spotify Init Error:', message); });
            spotifyPlayer.addListener('authentication_error', ({ message }) => { console.error('Spotify Auth Error:', message); });
            spotifyPlayer.addListener('account_error', ({ message }) => { console.error('Spotify Account Error:', message); });
            spotifyPlayer.addListener('playback_error', ({ message }) => { console.error('Spotify Playback Error:', message); });

            spotifyPlayer.addListener('player_state_changed', state => {
                if (!state) return;

                spotifyPaused = state.paused;
                spotifyPosition = state.position;
                spotifyDuration = state.duration;
                lastSpotifyUpdate = Date.now();

                const track = state.track_window.current_track;
                if (track) {
                    const title = track.name;
                    const artist = track.artists.map(a => a.name).join(", ");
                    let coverUrl = '';
                    if (track.album && track.album.images && track.album.images.length > 0) {
                        coverUrl = track.album.images[0].url;
                    }

                    document.getElementById("spTitle").innerText = title;
                    document.getElementById("spArtist").innerText = artist;
                    if (coverUrl) document.getElementById("spCover").src = coverUrl;

                    document.getElementById("spFsTitle").innerText = title;
                    document.getElementById("spFsArtist").innerText = artist;
                    if (coverUrl) {
                        document.getElementById("spFsCover").src = coverUrl;
                    }

                    if (currentTrackUri !== track.uri) {
                        currentTrackUri = track.uri;
                        const artistUri = track.artists && track.artists.length > 0 ? track.artists[0].uri : null;
                        if (artistUri) {
                            const artistId = artistUri.split(':').pop();
                            fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
                                headers: { 'Authorization': 'Bearer ' + currentSpotifyToken }
                            }).then(res => res.json()).then(artistData => {
                                if (artistData.images && artistData.images.length > 0) {
                                    document.getElementById("tv-background").style.backgroundImage = `url('${artistData.images[0].url}')`;
                                } else {
                                    document.getElementById("tv-background").style.backgroundImage = `url('${coverUrl}')`;
                                }
                            }).catch(err => {
                                console.error('Artist image fetch error:', err);
                                document.getElementById("tv-background").style.backgroundImage = `url('${coverUrl}')`;
                            });
                        } else if (coverUrl) {
                            document.getElementById("tv-background").style.backgroundImage = `url('${coverUrl}')`;
                        }
                    }

                    const playPath = spotifyPaused ? "M8 5v14l11-7z" : "M6 19h4V5H6v14zm8-14v14h4V5h-4z";
                    document.getElementById("spFsPlayIcon").innerHTML = `<svg viewBox="0 0 24 24"><path d="${playPath}"/></svg>`;
                }

                const nextTracks = state.track_window.next_tracks;
                if (nextTracks && nextTracks.length > 0) {
                    const nTrack = nextTracks[0];
                    const nArtist = nTrack.artists.map(a => a.name).join(", ");
                    document.getElementById("spFsNextTrack").innerText = nTrack.name + " - " + nArtist;
                    if (nTrack.album && nTrack.album.images && nTrack.album.images.length > 0) {
                        document.getElementById("spFsNextCover").src = nTrack.album.images[0].url;
                    }
                    document.getElementById("spFsUpNext").style.display = "flex";
                } else {
                    document.getElementById("spFsUpNext").style.display = "none";
                }
            });

            spotifyPlayer.connect();
        }

        async function checkTvSettings() {
            try {
                const res = await fetch(`/spotify/token${shopQueryQ}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.access_token && data.access_token !== currentSpotifyToken) {
                        currentSpotifyToken = data.access_token;
                        if (!document.getElementById("spotify-sdk")) {
                            const script = document.createElement("script");
                            script.id = "spotify-sdk";
                            script.src = "https://sdk.scdn.co/spotify-player.js";
                            script.onerror = () => {
                                document.getElementById('spTitle').innerText = "Spotify Yüklenemedi";
                                document.getElementById('spArtist').innerText = "Ağ engeli olabilir (Güvenli İnternet vb.)";
                            };
                            document.body.appendChild(script);
                        } else if (playerReady && !spotifyPlayer) {
                            initSpotifyPlayer();
                        }
                    }
                } else {
                    const err = await res.json();
                    if (err.error === 'not_logged_in' || err.error === 'refresh_failed') {
                        document.getElementById('spTitle').innerText = "Spotify Girişi Bekleniyor";
                        document.getElementById('spArtist').innerText = "Kasadan (App1) ayarlara girip Spotify'a Login olun.";
                    } else {
                        document.getElementById('spTitle').innerText = "Spotify Token Hatası";
                        document.getElementById('spArtist').innerText = err.error || "Bilinmeyen Hata";
                    }
                }
            } catch (e) {
                console.error("Spotify token hatasi:", e);
                document.getElementById('spTitle').innerText = "Bağlantı Hatası";
            }
        }
        
        async function fetchDailyTotal() {
            try {
                const totalRes = await fetch(`/daily_total${shopQueryQ}`);
                if (totalRes.status === 200) {
                    const totalData = await totalRes.json();
                    document.getElementById('dailyTotalText').innerText = parseFloat(totalData.total || 0).toLocaleString('tr-TR') + ' ₺';
                    if (totalData.screensaver && totalData.screensaver !== screensaverMode) {
                        screensaverMode = totalData.screensaver;
                        if (isCurrentlyIdle) {
                            manageScreensaver(true);
                        }
                    }
                }
            } catch(e) {
                // ignore fast polling errors
            }
        }

        setInterval(checkTvSettings, 5000);
        setInterval(fetchDailyTotal, 1000);
        checkTvSettings();
        fetchDailyTotal();

    