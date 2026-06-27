<script type="module">
        // V4 DATA WIPE & MIGRATION
        const APP_VERSION = "4.0.0";
        if (localStorage.getItem('nexus_app_version') !== APP_VERSION) {
            console.log("[V4 MIGRATION] Purging old local storage data...");
            const fbConfig = localStorage.getItem('nexus_fb_config');
            localStorage.clear();
            if (fbConfig) localStorage.setItem('nexus_fb_config', fbConfig); // keep fb config
            localStorage.setItem('nexus_app_version', APP_VERSION);
        }

        // Global system mode and database reference
        let db = null;
        let isSimulationMode = true;
        let activeFirebaseConfig = null;
        let currentUser = null;
        let isAdmin = false;
        let isRoot = false;
        let myRole = 'CIUDADANO';
        let forceOfflineMock = false;
        let globalCenters = [];
        let map = null;

        // UI View Elements
        const authView = document.getElementById('auth-view');
        const dashView = document.getElementById('dashboard-view');
        const adminView = document.getElementById('admin-view');
        const settingsPanel = document.getElementById('settings-panel');
        const adminSettingsContainer = document.getElementById('admin-settings-container');
        const simulationBanner = document.getElementById('simulation-banner');
        
        // Admin UI Elements
        const btnAdminTab = document.getElementById('btn-admin-tab');
        const btnAdminExit = document.getElementById('btn-admin-exit');
        const adminCodeInput = document.getElementById('admin-code-input');
        const btnLoginAdmin = document.getElementById('btn-login-admin');
        const acopioManagerForm = document.getElementById('acopio-manager-form');
        const adminSosList = document.getElementById('admin-sos-list');
        const adminDamageList = document.getElementById('admin-damage-list');
        const adminAcopioList = document.getElementById('admin-acopio-list');
        const metricSos = document.getElementById('metric-sos');
        const metricDanio = document.getElementById('metric-danio');
        const metricRegistros = document.getElementById('metric-registros');
        const metricHabitantes = document.getElementById('metric-habitantes');
        
        // Form & Details Elements
        const regForm = document.getElementById('reg-form');
        const cedulaInput = document.getElementById('cedula');
        const cedulaError = document.getElementById('cedula-error');
        const userDisplayName = document.getElementById('user-display-name');
        const userDisplayId = document.getElementById('user-display-id');
        
        // Controls
        const btnSettings = document.getElementById('btn-settings');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        const btnSaveConfig = document.getElementById('btn-save-config');
        const btnClearConfig = document.getElementById('btn-clear-config');
        const fbConfigJson = document.getElementById('fb-config-json');
        const firebaseStatusBadge = document.getElementById('firebase-status-badge');
        
        const btnSimOffline = document.getElementById('btn-sim-offline');
        const btnSimOnline = document.getElementById('btn-sim-online');
        const btnResetUser = document.getElementById('btn-reset-user');
        
        const networkStatus = document.getElementById('network-status');
        const networkText = document.getElementById('network-text');
        const coordsText = document.getElementById('coords-text');

        // Dynamic feed lists
        const acopioFeed = document.getElementById('acopio-feed');
        const queueList = document.getElementById('queue-list');
        const queueCount = document.getElementById('queue-count');

        // Slider logic
        const damageSlider = document.getElementById('damage-slider');
        const sliderValBadge = document.getElementById('slider-val-badge');
        const damageDesc = document.getElementById('damage-desc');

        // V2 DOM elements
        const meshCountText = document.getElementById('mesh-count');
        const seismicAlert = document.getElementById('seismic-alert');
        const broadcastAlert = document.getElementById('broadcast-alert');
        const broadcastMessageText = document.getElementById('broadcast-message-text');
        const adminMessage = document.getElementById('admin-message');
        const btnSendAlert = document.getElementById('btn-send-alert');

        // Queue array for fully manual simulated transmission
        let mockQueue = JSON.parse(localStorage.getItem('nexus_mock_queue') || '[]');

        // Initialize connection status
        function updateNetworkStatus() {
            const isOnline = navigator.onLine && !forceOfflineMock;
            if (isOnline) {
                networkStatus.style.backgroundColor = '#22c55e';
                networkStatus.style.boxShadow = '0 0 12px #22c55e';
                networkText.innerText = 'En Línea';
                networkText.style.color = '#22c55e';
                
                // Trigger online sync for Simulation Mode queue
                if (isSimulationMode) {
                    processMockQueue();
                }
            } else {
                networkStatus.style.backgroundColor = '#ef4444';
                networkStatus.style.boxShadow = '0 0 12px #ef4444';
                networkText.innerText = 'Sin Red';
                networkText.style.color = '#ef4444';
            }
        }

        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();

        // SIMULATION MODE WORKFLOW
        // Mock Acopio Centers default data
        const defaultAcopioCenters = [
            { id: 1, name: "Plaza Bolívar Chacao", status: "ACTIVO", needs: "Agua embotellada, analgésicos, gasas", updated: "Hace 5 min" },
            { id: 2, name: "C.C. San Ignacio (Sótano)", status: "ALERTA", needs: "Linternas, baterías, cobijas", updated: "Hace 15 min" },
            { id: 3, name: "Parque Altamira", status: "PREPARACIÓN", needs: "Personal médico de apoyo", updated: "Hace 1 hora" }
        ];

        // Save & Load Mock Queue
        function saveMockQueue() {
            localStorage.setItem('nexus_mock_queue', JSON.stringify(mockQueue));
            renderQueue();
        }

        function renderQueue() {
            queueCount.innerText = `${mockQueue.length} en espera`;
            if (mockQueue.length === 0) {
                queueList.innerHTML = `<p class="text-center py-2 text-gray-600">No hay reportes pendientes.</p>`;
                return;
            }

            queueList.innerHTML = mockQueue.map((item, idx) => {
                let badge = `<span class="px-1.5 py-0.5 rounded text-[8px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold uppercase">OFFLINE</span>`;
                if (item.synced) {
                    badge = `<span class="px-1.5 py-0.5 rounded text-[8px] bg-green-500/10 text-green-400 border border-green-500/20 font-bold uppercase">ENVIADO</span>`;
                }
                
                return `
                    <div class="p-2 bg-nexusNavyLight/45 rounded border border-nexusBronze/20 flex justify-between items-center text-[10px]">
                        <div>
                            <span class="font-bold text-nexusBronze">[${item.type.toUpperCase()}]</span> 
                            <span class="text-gray-400 ml-1">${new Date(item.timestamp).toLocaleTimeString()}</span>
                            <div class="text-[9px] text-gray-400 truncate max-w-[200px] mt-0.5">${JSON.stringify(item.data)}</div>
                        </div>
                        <div>${badge}</div>
                    </div>
                `;
            }).join('');
        }

        // Process Mock sync when connection returns
        function processMockQueue() {
            if (mockQueue.length === 0) return;
            console.log('[Mock DB] Intentando sincronizar reportes locales en cola...');
            
            mockQueue.forEach((item, index) => {
                if (!item.synced) {
                    item.synced = true;
                    console.log(`[Mock DB] Reporte sincronizado con éxito: [${item.type}]`, item.data);
                }
            });
            
            // Clear synced reports after a brief display delay
            setTimeout(() => {
                mockQueue = mockQueue.filter(item => !item.synced);
                saveMockQueue();
            }, 3000);
            
            saveMockQueue();
        }

        // Add to Mock queue
        function queueMockReport(type, data) {
            const queueItem = {
                type,
                data,
                timestamp: new Date().toISOString(),
                synced: navigator.onLine && !forceOfflineMock
            };
            
            mockQueue.unshift(queueItem);
            saveMockQueue();

            if (queueItem.synced) {
                // Flash success toast
                alert(`[Enviado en Vivo] Reporte de ${type.toUpperCase()} registrado con éxito en red.`);
                
                // Instantly remove from queue if sent immediately in mock mode
                setTimeout(() => {
                    mockQueue = mockQueue.filter(item => item !== queueItem);
                    saveMockQueue();
                }, 1500);
            } else {
                alert(`[Offline] Sin conexión. Reporte de ${type.toUpperCase()} guardado localmente en IndexedDB. Se sincronizará automáticamente.`);
            }
        }

        // Render Acopio Feed
        function renderAcopioFeed(centers) {
            acopioFeed.innerHTML = centers.map(center => {
                let badgeColor = 'bg-green-500/10 text-green-400 border border-green-500/20';
                if (center.status === 'ALERTA') badgeColor = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
                if (center.status === 'CRÍTICO') badgeColor = 'bg-nexusRed/10 text-nexusRed border border-nexusRed/20';

                return `
                    <div class="p-3 bg-nexusNavyLight/30 rounded border border-nexusBronze/10 hover:border-nexusBronze/30 transition-all duration-200 flex justify-between items-start space-x-3">
                        <div class="space-y-1">
                            <h4 class="font-bold text-sm text-gray-200 font-tactical">${center.name}</h4>
                            <p class="text-xs text-nexusBronze font-medium">Requerimientos: <span class="text-gray-300 font-sans font-normal">${center.needs}</span></p>
                            <span class="text-[9px] font-mono text-gray-500 block pt-1">Actualizado: ${center.updated}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-widest ${badgeColor}">${center.status}</span>
                    </div>
                `;
            }).join('');
        }

        // Initialize UI with mock data initially
        renderAcopioFeed(defaultAcopioCenters);
        renderQueue();

        // SLIDER DYNAMIC UX COLORS
        damageSlider.addEventListener('input', () => {
            const val = parseInt(damageSlider.value);
            let colorClass = 'text-green-400 bg-green-500/20 border-green-500/40';
            let desc = '';
            
            if (val <= 3) {
                colorClass = 'text-green-400 bg-green-500/20 border-green-500/40';
                desc = 'Leve: Fisuras superficiales en pintura, mampostería intacta. Estructura segura.';
                damageSlider.style.accentColor = '#22c55e';
            } else if (val <= 6) {
                colorClass = 'text-yellow-400 bg-yellow-500/20 border-yellow-500/40';
                desc = 'Moderado: Desprendimiento de revoques, fisuras en paredes. Precaución, vigas estables.';
                damageSlider.style.accentColor = '#eab308';
            } else if (val <= 8) {
                colorClass = 'text-orange-400 bg-orange-500/20 border-orange-500/40';
                desc = 'Grave: Agrietamiento en vigas y columnas principales. Salir de la estructura de inmediato.';
                damageSlider.style.accentColor = '#f97316';
            } else {
                colorClass = 'text-nexusRed bg-nexusRed/20 border-nexusRed/40 status-pulse-dot';
                desc = 'Crítico / Colapso: Daño mayor estructural, asentamiento, columnas expuestas. ¡PELIGRO EXTREMO!';
                damageSlider.style.accentColor = '#E63946';
            }
            
            sliderValBadge.className = `font-mono text-sm font-bold border px-2 py-0.5 rounded ${colorClass}`;
            sliderValBadge.innerText = `Nivel ${val}`;
            damageDesc.innerText = desc;
            damageDesc.className = `p-3 rounded text-xs font-mono border ${colorClass}`;
        });

        // VALIDACIÓN DE CÉDULA VENEZOLANA
        cedulaInput.addEventListener('input', () => {
            const val = cedulaInput.value.trim().toUpperCase();
            // Regex match for V-12345678 or E-12345678 formats
            const cedulaRegex = /^[VEve]-\d{5,9}$/;
            if (val === "" || cedulaRegex.test(val)) {
                cedulaError.classList.add('hidden');
                cedulaInput.classList.remove('border-nexusRed');
            } else {
                cedulaError.classList.remove('hidden');
                cedulaInput.classList.add('border-nexusRed');
            }
        });

        // FIREBASE FIRELOAD MODULE
        async function setupFirebase(config) {
            try {
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
                const { 
                    initializeFirestore, 
                    collection, 
                    addDoc, 
                    onSnapshot, 
                    query, 
                    orderBy, 
                    limit, 
                    persistentLocalCache, 
                    persistentMultipleTabManager 
                } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

                // Initialize App
                const app = initializeApp(config);
                
                // Initialize Firestore with robust multi-tab persistent cache
                db = initializeFirestore(app, {
                    localCache: persistentLocalCache({
                        tabManager: persistentMultipleTabManager()
                    })
                });

                isSimulationMode = false;
                simulationBanner.classList.add('hidden');
                firebaseStatusBadge.innerText = 'EN LÍNEA';
                firebaseStatusBadge.className = 'text-[10px] font-mono uppercase bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded';
                console.log('[Firebase DB] Inicializado con éxito con persistencia IndexedDB habilitada.');

                // Subscribe to Real Firestore Acopio Centers feed
                const acopioQuery = query(collection(db, "centros_acopio_v4"), orderBy("updatedAt", "desc"), limit(10));
                
                onSnapshot(acopioQuery, (snapshot) => {
                    const centers = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        centers.push({
                            id: doc.id,
                            name: data.nombre || "Centro Sin Nombre",
                            status: data.estado || "ACTIVO",
                            needs: data.necesidades || "Ninguna registrada",
                            updated: data.updatedAt ? new Date(data.updatedAt.seconds * 1000).toLocaleTimeString() : 'Recién'
                        });
                    });

                    globalCenters = centers;
                    if (centers.length > 0) {
                        renderAcopioFeed(centers);
                        renderAdminAcopioList(centers);
                    } else {
                        // Seeding Firestore with default centers for visual feedback if collection empty
                        seedDefaultAcopioCenters();
                    }
                }, (error) => {
                    console.warn('[Firebase DB] Error cargando centros de acopio en vivo:', error.message);
                    renderAcopioFeed(defaultAcopioCenters);
                    renderAdminAcopioList(defaultAcopioCenters);
                });

                // Subscribe to Registrations (Metrics)
                onSnapshot(collection(db, "registros_chacao_v4"), (snapshot) => {
                    let totalReg = 0;
                    let totalHab = 0;
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        totalReg++;
                        totalHab += parseInt(data.habitantes || 0);
                    });
                    metricRegistros.innerText = totalReg;
                    metricHabitantes.innerText = totalHab;
                });

                // Subscribe to SOS Alerts
                onSnapshot(collection(db, "alertas_sos_v4"), (snapshot) => {
                    const alerts = [];
                    snapshot.forEach((doc) => {
                        alerts.push({ id: doc.id, ...doc.data() });
                    });
                    renderAdminSos(alerts);
                });

                // Subscribe to Damage Reports
                onSnapshot(collection(db, "reportes_danio_v4"), (snapshot) => {
                    const reports = [];
                    snapshot.forEach((doc) => {
                        reports.push({ id: doc.id, ...doc.data() });
                    });
                    renderAdminDamage(reports);
                    loadMapMarkers(); // Draw Leaflet map markers
                });

                // Subscribe to Broadcast Alerts (Authority messaging console)
                const broadcastQuery = query(collection(db, "mensajes_acopio_v4"), orderBy("timestamp", "desc"), limit(1));
                onSnapshot(broadcastQuery, (snapshot) => {
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        if (data && data.mensaje) {
                            broadcastMessageText.innerText = data.mensaje;
                            broadcastAlert.classList.remove('hidden');
                        }
                    });
                });

                return true;
            } catch (err) {
                console.error('[Firebase Setup] Falló la inicialización real de Firebase, cayendo en Modo Simulación:', err);
                isSimulationMode = true;
                simulationBanner.classList.remove('hidden');
                firebaseStatusBadge.innerText = 'FALLÓ / MOCK';
                firebaseStatusBadge.className = 'text-[10px] font-mono uppercase bg-nexusRed/20 text-nexusRed border border-nexusRed/30 px-2 py-0.5 rounded';
                return false;
            }
        }

        // Seed default centers in FireStore for initial configuration convenience
        async function seedDefaultAcopioCenters() {
            if (!db || isSimulationMode) return;
            try {
                const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const batchPromises = defaultAcopioCenters.map(center => {
                    return addDoc(collection(db, "centros_acopio_v4"), {
                        nombre: center.name,
                        estado: center.status,
                        necesidades: center.needs,
                        updatedAt: new Date()
                    });
                });
                await Promise.all(batchPromises);
                console.log('[Firebase DB] Centros de acopio sembrados en Firestore exitosamente.');
            } catch (err) {
                console.warn('[Firebase DB] Falló siembra de centros:', err);
            }
        }

        // LOAD SECURED FIREBASE KEY FROM STORAGE OR FALLBACK
        const defaultFirebaseConfig = {
            apiKey: "AIzaSyDzHirGhp-PiasxD4xn3HUFmpQ90aNxsLI",
            authDomain: "nexus-security-chacao-v1.firebaseapp.com",
            projectId: "nexus-security-chacao-v1",
            storageBucket: "nexus-security-chacao-v1.firebasestorage.app",
            messagingSenderId: "478828977258",
            appId: "1:478828977258:web:fa08617bb3df025da83e13",
            measurementId: "G-G59QMC6EL2"
        };

        const storedConfig = localStorage.getItem('nexus_fb_config');
        if (storedConfig) {
            try {
                activeFirebaseConfig = JSON.parse(storedConfig);
                fbConfigJson.value = JSON.stringify(activeFirebaseConfig, null, 2);
                setupFirebase(activeFirebaseConfig);
            } catch (e) {
                console.error('Configuración almacenada de Firebase corrupta:', e);
                // Fallback to project default config
                activeFirebaseConfig = defaultFirebaseConfig;
                fbConfigJson.value = JSON.stringify(defaultFirebaseConfig, null, 2);
                setupFirebase(defaultFirebaseConfig);
            }
        } else {
            console.log('[Sistema] Iniciando con configuración de Firebase predeterminada.');
            activeFirebaseConfig = defaultFirebaseConfig;
            fbConfigJson.value = JSON.stringify(defaultFirebaseConfig, null, 2);
            setupFirebase(defaultFirebaseConfig);
        }

        // SAVE & REBOOT FOR CONFIG PANEL
        btnSaveConfig.addEventListener('click', () => {
            const rawJson = fbConfigJson.value.trim();
            if (!rawJson) {
                alert("Introduce una configuración válida.");
                return;
            }

            try {
                const configParsed = JSON.parse(rawJson);
                if (!configParsed.apiKey || !configParsed.projectId) {
                    throw new Error("El JSON no parece contener una configuración válida de Firebase (falta apiKey o projectId).");
                }
                
                localStorage.setItem('nexus_fb_config', JSON.stringify(configParsed));
                alert("Configuración guardada. Reiniciando conexión...");
                location.reload();
            } catch (err) {
                alert("Error al analizar JSON de Firebase: " + err.message);
            }
        });

        // CLEAR CONFIG
        btnClearConfig.addEventListener('click', () => {
            if (confirm("¿Estás seguro de eliminar las credenciales de Firebase? La aplicación volverá al Modo Simulación.")) {
                localStorage.removeItem('nexus_fb_config');
                alert("Credenciales eliminadas. Reiniciando...");
                location.reload();
            }
        });

        // CONTROLS FOR MOCK SIMULATION PANEL
        btnSimOffline.addEventListener('click', () => {
            forceOfflineMock = true;
            updateNetworkStatus();
            alert("Dispositivo forzado a modo OFFLINE. La red se simula inactiva.");
        });

        btnSimOnline.addEventListener('click', () => {
            forceOfflineMock = false;
            updateNetworkStatus();
            alert("Dispositivo reconectado a red virtual.");
        });

        // LOGOUT/USER RESET
        btnResetUser.addEventListener('click', () => {
            if (confirm("¿Deseas borrar la sesión de usuario activa? Volverás a la pantalla de registro.")) {
                localStorage.removeItem('nexus_user');
                currentUser = null;
                authView.classList.remove('hidden');
                dashView.classList.add('hidden');
                settingsPanel.classList.add('translate-x-full');
            }
        });

        // REGISTRATION ACTION
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombre = document.getElementById('nombre').value.trim();
            const cedula = document.getElementById('cedula').value.trim().toUpperCase();
            const correo = document.getElementById('correo').value.trim();
            const instagram = document.getElementById('instagram').value.trim();
            const edificio = document.getElementById('edificio').value;
            const habitantes = parseInt(document.getElementById('habitantes').value);
            const pin_sos = document.getElementById('pin-sos').value.trim();

            // Double check validation
            const cedulaRegex = /^[VEve]-\d{5,9}$/;
            if (!cedulaRegex.test(cedula)) {
                cedulaError.classList.remove('hidden');
                return;
            }

            if (pin_sos.length !== 4) {
                alert("El PIN debe tener exactamente 4 dígitos.");
                return;
            }

            const userData = {
                nombre,
                cedula,
                correo,
                instagram,
                edificio,
                habitantes,
                pin_sos,
                timestamp: new Date().toISOString()
            };

            // Save session locally
            localStorage.setItem('nexus_user', JSON.stringify(userData));
            currentUser = userData;
            
            // Render user details to dashboard
            userDisplayName.innerText = userData.nombre;
            userDisplayId.innerText = userData.cedula;

            // Submit to Database (or mock queue)
            if (!isSimulationMode && db) {
                try {
                    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    await addDoc(collection(db, "registros_chacao_v4"), userData);
                    console.log('[Firebase DB] Registro enviado en vivo.');
                } catch (err) {
                    console.warn('[Firebase DB Offline-Enqueued] Error en registro de red, guardado en cache de Firestore:', err.message);
                }
            } else {
                let regs = JSON.parse(localStorage.getItem('nexus_mock_registros') || '[]');
                regs.push(userData);
                localStorage.setItem('nexus_mock_registros', JSON.stringify(regs));
                queueMockReport('registro', userData);
            }

            // Transition views
            authView.classList.add('hidden');
            dashView.classList.remove('hidden');
            setTimeout(initMap, 500);
            checkUserRole(userData.cedula);
        });

        async function checkUserRole(cedula) {
            if ("Notification" in window && Notification.permission !== "granted") {
                Notification.requestPermission();
            }
            if (!isSimulationMode && db) {
                try {
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    const roleSnap = await getDoc(doc(db, "roles_autoridad_v4", cedula));
                    if (roleSnap.exists()) {
                        isAdmin = true;
                        myRole = roleSnap.data().role;
                        btnAdminTab.classList.remove('hidden');
                        console.log(`[RBAC] Autoridad detectada: ${myRole}`);
                    }
                } catch (e) {
                    console.error("[RBAC] Error validando rol:", e);
                }
            }
        }

        // AUTO-LOGIN IF SESSION ACTIVE
        const savedSession = localStorage.getItem('nexus_user');
        if (savedSession) {
            try {
                currentUser = JSON.parse(savedSession);
                userDisplayName.innerText = currentUser.nombre;
                userDisplayId.innerText = currentUser.cedula;
                authView.classList.add('hidden');
                dashView.classList.remove('hidden');
                setTimeout(initMap, 500);
                setTimeout(() => checkUserRole(currentUser.cedula), 1000);
            } catch (e) {
                console.error("Error cargando sesión activa:", e);
                localStorage.removeItem('nexus_user');
            }
        }

        // TRIGGER EMERGENCY SOS BUTTON (HOLD TO SOS)
        const btnSos = document.getElementById('btn-sos');
        const sosProgressRing = document.getElementById('sos-progress-ring');
        const pinModal = document.getElementById('pin-modal');
        const pinInput = document.getElementById('sos-pin-confirm');
        const btnCancelSos = document.getElementById('btn-cancel-sos');
        const btnConfirmSos = document.getElementById('btn-confirm-sos');
        
        let sosHoldTimer = null;
        const SOS_HOLD_DURATION = 3000; // 3 seconds
        let isHolding = false;
        let animationFrame = null;
        let holdStartTime = 0;

        function animateProgress() {
            if (!isHolding) {
                sosProgressRing.style.strokeDashoffset = "289";
                return;
            }
            const elapsed = Date.now() - holdStartTime;
            const progress = Math.min(elapsed / SOS_HOLD_DURATION, 1);
            const dashoffset = 289 - (289 * progress);
            sosProgressRing.style.strokeDashoffset = dashoffset;
            
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animateProgress);
            }
        }

        function startSosHold(e) {
            if (!currentUser) return alert("Registra tu usuario primero.");
            e.preventDefault();
            isHolding = true;
            holdStartTime = Date.now();
            animateProgress();
            
            sosHoldTimer = setTimeout(() => {
                isHolding = false;
                sosProgressRing.style.strokeDashoffset = "0";
                pinInput.value = '';
                pinModal.classList.remove('hidden');
                setTimeout(() => pinInput.focus(), 100);
            }, SOS_HOLD_DURATION);
        }

        function stopSosHold() {
            if (!isHolding) return;
            isHolding = false;
            clearTimeout(sosHoldTimer);
            if (animationFrame) cancelAnimationFrame(animationFrame);
            sosProgressRing.style.strokeDashoffset = "289";
        }

        btnSos.addEventListener('mousedown', startSosHold);
        btnSos.addEventListener('touchstart', startSosHold, {passive: false});
        
        window.addEventListener('mouseup', stopSosHold);
        window.addEventListener('touchend', stopSosHold);

        btnCancelSos.addEventListener('click', () => {
            pinModal.classList.add('hidden');
            sosProgressRing.style.strokeDashoffset = "289";
        });

        btnConfirmSos.addEventListener('click', () => {
            const enteredPin = pinInput.value.trim();
            if (enteredPin !== currentUser.pin_sos) {
                alert("PIN INCORRECTO. Acceso denegado.");
                return;
            }
            pinModal.classList.add('hidden');
            sosProgressRing.style.strokeDashoffset = "289";
            executeSosTransmission();
        });

        function executeSosTransmission() {
            // Request GPS coordinates
            if (navigator.geolocation) {
                coordsText.innerText = 'GPS: SOLICITANDO...';
                
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    coordsText.innerText = `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    
                    const sosData = {
                        cedula: currentUser.cedula,
                        nombre: currentUser.nombre,
                        edificio: currentUser.edificio,
                        habitantes: currentUser.habitantes,
                        lat,
                        lng,
                        timestamp: new Date().toISOString()
                    };

                    if (!isSimulationMode && db) {
                        try {
                            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                            await addDoc(collection(db, "alertas_sos_v4"), sosData);
                            alert("SOS Emitido y geolocalizado en red Firestore.");
                        } catch (err) {
                            console.warn('[Firebase DB Offline-Enqueued] SOS encolado en cache local:', err.message);
                            alert("SOS Guardado en el cache de Firestore. Se enviará apenas se detecte red.");
                        }
                    } else {
                        let sosList = JSON.parse(localStorage.getItem('nexus_mock_sos') || '[]');
                        sosList.push({ id: Date.now().toString(), ...sosData });
                        localStorage.setItem('nexus_mock_sos', JSON.stringify(sosList));
                        queueMockReport('sos', sosData);
                        alert("SOS Emitido Localmente.");
                    }

                }, (error) => {
                    console.error("Error de Geolocalización:", error);
                    coordsText.innerText = 'GPS: FALLIDO / SIN PERMISO';
                    
                    // Fallback to sending SOS without geolocation
                    const sosDataNoGeo = {
                        cedula: currentUser.cedula,
                        nombre: currentUser.nombre,
                        edificio: currentUser.edificio,
                        habitantes: currentUser.habitantes,
                        lat: null,
                        lng: null,
                        timestamp: new Date().toISOString()
                    };

                    if (!isSimulationMode && db) {
                        import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then(({ collection, addDoc }) => {
                            addDoc(collection(db, "alertas_sos_v4"), sosDataNoGeo);
                            alert("SOS Emitido (Sin GPS por restricción o error) y guardado en Firestore.");
                        });
                    } else {
                        let sosList = JSON.parse(localStorage.getItem('nexus_mock_sos') || '[]');
                        sosList.push({ id: Date.now().toString(), ...sosDataNoGeo });
                        localStorage.setItem('nexus_mock_sos', JSON.stringify(sosList));
                        queueMockReport('sos', sosDataNoGeo);
                        alert("SOS Emitido Localmente sin GPS.");
                    }
                }, {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 0
                });
            } else {
                alert("Geolocalización no soportada por este navegador.");
            }
        }

        // TRIAJE MÉDICO
        document.querySelectorAll('.btn-triaje').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!currentUser) return alert("Registra tu usuario primero.");
                const level = e.currentTarget.getAttribute('data-level');
                if (confirm(`¿Estás seguro de enviar un reporte de Triaje Médico con nivel: ${level}?`)) {
                    const triajeData = {
                        cedula: currentUser.cedula,
                        nombre: currentUser.nombre,
                        edificio: currentUser.edificio,
                        nivel: level,
                        timestamp: new Date().toISOString()
                    };

                    if (!isSimulationMode && db) {
                        try {
                            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                            await addDoc(collection(db, "reportes_triaje_v4"), triajeData);
                            alert(`Reporte médico ${level} transmitido con éxito.`);
                        } catch (err) {
                            alert("Reporte médico guardado en caché.");
                        }
                    } else {
                        alert(`Reporte médico local simulado con nivel ${level}.`);
                    }
                }
            });
        });

        // TRANSMIT STRUCTURAL DAMAGE REPORT
        const btnReport = document.getElementById('btn-report');
        btnReport.addEventListener('click', async () => {
            if (!currentUser) return alert("Registra tu usuario primero.");

            const nivel = parseInt(damageSlider.value);
            const comentarios = document.getElementById('damage-comment').value.trim();

            const damageData = {
                cedula: currentUser.cedula,
                edificio: currentUser.edificio,
                nivel_danio: nivel,
                comentarios,
                timestamp: new Date().toISOString()
            };

            if (!isSimulationMode && db) {
                try {
                    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    await addDoc(collection(db, "reportes_danio_v4"), damageData);
                    alert("Reporte de daños enviado con éxito.");
                    document.getElementById('damage-comment').value = '';
                } catch (err) {
                    console.warn('[Firebase DB Offline-Enqueued] Reporte encolado:', err.message);
                    alert("Reporte guardado en caché local. Se sincronizará automáticamente.");
                    document.getElementById('damage-comment').value = '';
                }
            } else {
                let damageList = JSON.parse(localStorage.getItem('nexus_mock_damage') || '[]');
                damageList.push({ id: Date.now().toString(), ...damageData });
                localStorage.setItem('nexus_mock_damage', JSON.stringify(damageList));
                queueMockReport('daño', damageData);
                document.getElementById('damage-comment').value = '';
            }
        });

        // TOGGLE SETTINGS PANEL
        btnSettings.addEventListener('click', () => {
            settingsPanel.classList.remove('translate-x-full');
        });

        btnCloseSettings.addEventListener('click', () => {
            settingsPanel.classList.add('translate-x-full');
        });

        // ==========================================
        // CENTRO DE CONTROL TÁCTICO (ADMIN LOGIC)
        // ==========================================

        // Render SOS alerts in admin dashboard
        function renderAdminSos(alerts) {
            metricSos.innerText = alerts.length;
            if (alerts.length === 0) {
                adminSosList.innerHTML = `<p class="text-center py-4 text-xs font-mono text-gray-500">No hay alertas SOS registradas.</p>`;
                return;
            }
            adminSosList.innerHTML = alerts.map(alert => {
                const mapLink = alert.lat ? `<a href="https://maps.google.com/?q=${alert.lat},${alert.lng}" target="_blank" class="text-blue-400 underline hover:text-blue-300">GPS: ${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}</a>` : 'Sin GPS';
                return `
                    <div class="p-3 bg-nexusNavyLight/55 rounded border border-nexusRed/30 flex justify-between items-center text-xs">
                        <div class="space-y-1">
                            <div class="flex items-center space-x-2">
                                <span class="font-bold text-nexusRed font-tactical">[SOS EN CURSO]</span>
                                <span class="font-mono text-gray-400">${alert.cedula}</span>
                            </div>
                            <p class="text-gray-200">Afectado: <span class="font-bold">${alert.nombre || 'Desconocido'}</span> (${alert.edificio || 'Sin ubicación'})</p>
                            <div class="flex items-center space-x-4 text-[10px] font-mono text-gray-500">
                                <span>Acompañantes: ${alert.habitantes || 0}</span>
                                <span>${mapLink}</span>
                                <span>${new Date(alert.timestamp).toLocaleTimeString()}</span>
                            </div>
                        </div>
                        <button onclick="resolveSos('${alert.id}')" class="px-2.5 py-1.5 bg-nexusRed/20 hover:bg-nexusRed text-nexusRed hover:text-white rounded border border-nexusRed/55 font-bold font-mono text-[10px] uppercase transition-colors">
                            Atender
                        </button>
                    </div>
                `;
            }).join('');
        }

        // Render damage reports in admin dashboard
        function renderAdminDamage(reports) {
            metricDanio.innerText = reports.length;
            reports.sort((a, b) => b.nivel_danio - a.nivel_danio);
            
            if (reports.length === 0) {
                adminDamageList.innerHTML = `<p class="text-center py-4 text-xs font-mono text-gray-500">No hay reportes de daño estructural.</p>`;
                return;
            }
            adminDamageList.innerHTML = reports.map(report => {
                let colorClass = 'text-green-400 bg-green-500/10 border-green-500/30';
                if (report.nivel_danio > 3) colorClass = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
                if (report.nivel_danio > 6) colorClass = 'text-orange-400 bg-orange-500/10 border-orange-500/30';
                if (report.nivel_danio > 8) colorClass = 'text-nexusRed bg-nexusRed/10 border-nexusRed/30 status-pulse-dot';

                return `
                    <div class="p-3 bg-nexusNavyLight/30 rounded border border-nexusBronze/10 flex justify-between items-start text-xs">
                        <div class="space-y-1">
                            <div class="flex items-center space-x-2">
                                <span class="font-bold text-gray-300 font-tactical">${report.edificio}</span>
                                <span class="font-mono text-gray-500">C.I: ${report.cedula}</span>
                            </div>
                            <p class="text-gray-400 italic">Observaciones: "${report.comentarios || 'Sin comentarios'}"</p>
                            <span class="text-[9px] font-mono text-gray-500 block">Reportado: ${new Date(report.timestamp).toLocaleString()}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest ${colorClass}">
                            Nivel ${report.nivel_danio}
                        </span>
                    </div>
                `;
            }).join('');
        }

        // Render acopio centers in admin list
        function renderAdminAcopioList(centers) {
            if (centers.length === 0) {
                adminAcopioList.innerHTML = `<p class="text-center py-2 text-xs font-mono text-gray-600">No hay centros guardados.</p>`;
                return;
            }
            adminAcopioList.innerHTML = centers.map(center => {
                let badgeColor = 'bg-green-500/10 text-green-400 border border-green-500/20';
                if (center.status === 'ALERTA' || center.estado === 'ALERTA') badgeColor = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
                if (center.status === 'CRÍTICO' || center.estado === 'CRÍTICO') badgeColor = 'bg-nexusRed/10 text-nexusRed border border-nexusRed/20';

                const name = center.nombre || center.name || "Centro Sin Nombre";
                const status = center.estado || center.status || "ACTIVO";

                return `
                    <div class="p-2.5 bg-nexusNavyLight/20 rounded border border-nexusBronze/10 flex justify-between items-center text-xs">
                        <div class="space-y-0.5 truncate max-w-[200px]">
                            <h5 class="font-bold text-gray-200 truncate">${name}</h5>
                            <span class="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${badgeColor}">${status}</span>
                        </div>
                        <div class="flex space-x-1">
                            <button onclick="editAcopio('${center.id}')" class="p-1 text-nexusBronze hover:text-white" title="Editar">
                                <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"></path>
                                </svg>
                            </button>
                            <button onclick="deleteAcopio('${center.id}')" class="p-1 text-nexusRed hover:text-red-400" title="Eliminar">
                                <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Update local arrays and render for Simulation Mode
        function updateAdminSimulationData() {
            if (!isSimulationMode) return;
            const mockRegistros = JSON.parse(localStorage.getItem('nexus_mock_registros') || '[]');
            const mockSos = JSON.parse(localStorage.getItem('nexus_mock_sos') || '[]');
            const mockDamage = JSON.parse(localStorage.getItem('nexus_mock_damage') || '[]');
            const mockAcopio = JSON.parse(localStorage.getItem('nexus_mock_acopio') || JSON.stringify(defaultAcopioCenters));
            
            let totalReg = mockRegistros.length;
            let totalHab = 0;
            mockRegistros.forEach(r => totalHab += (parseInt(r.habitantes) || 0));

            if (currentUser) {
                totalReg++;
                totalHab += (parseInt(currentUser.habitantes) || 0);
            }

            metricRegistros.innerText = totalReg;
            metricHabitantes.innerText = totalHab;

            renderAdminSos(mockSos);
            renderAdminDamage(mockDamage);
            renderAdminAcopioList(mockAcopio);
        }

        // Resolving / Archiving SOS Alert
        window.resolveSos = async function(id) {
            if (!confirm("¿Deseas archivar esta alerta SOS? Se eliminará del centro de control.")) return;
            if (!isSimulationMode && db) {
                try {
                    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    await deleteDoc(doc(db, "alertas_sos_v4", id));
                } catch (e) {
                    alert("Error: " + e.message);
                }
            } else {
                let mockSos = JSON.parse(localStorage.getItem('nexus_mock_sos') || '[]');
                mockSos = mockSos.filter(alert => alert.id !== id);
                localStorage.setItem('nexus_mock_sos', JSON.stringify(mockSos));
                updateAdminSimulationData();
            }
        };

        // Editing Acopio Centers
        let editingCenterId = null;
        window.editAcopio = function(id) {
            let center = null;
            if (isSimulationMode) {
                const centers = JSON.parse(localStorage.getItem('nexus_mock_acopio') || JSON.stringify(defaultAcopioCenters));
                center = centers.find(c => c.id.toString() === id.toString());
            } else {
                center = globalCenters.find(c => c.id === id);
            }
            
            if (center) {
                document.getElementById('acopio-name').value = center.nombre || center.name || "";
                document.getElementById('acopio-needs').value = center.necesidades || center.needs || "";
                document.getElementById('acopio-status').value = center.estado || center.status || "ACTIVO";
                editingCenterId = id;
                document.getElementById('btn-save-acopio').innerText = "ACTUALIZAR CENTRO";
            }
        };

        // Deleting Acopio Centers
        window.deleteAcopio = async function(id) {
            if (!confirm("¿Deseas eliminar este centro de acopio?")) return;
            if (!isSimulationMode && db) {
                try {
                    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    await deleteDoc(doc(db, "centros_acopio_v4", id));
                } catch (e) {
                    alert("Error: " + e.message);
                }
            } else {
                let centers = JSON.parse(localStorage.getItem('nexus_mock_acopio') || JSON.stringify(defaultAcopioCenters));
                centers = centers.filter(c => c.id.toString() !== id.toString());
                localStorage.setItem('nexus_mock_acopio', JSON.stringify(centers));
                updateAdminSimulationData();
                renderAcopioFeed(centers);
            }
        };

        // Admin Acopio Form Submission
        const acopioName = document.getElementById('acopio-name');
        const acopioNeeds = document.getElementById('acopio-needs');
        const acopioStatus = document.getElementById('acopio-status');

        acopioManagerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = acopioName.value.trim();
            const necesidades = acopioNeeds.value.trim();
            const estado = acopioStatus.value;

            if (!isSimulationMode && db) {
                try {
                    const { collection, addDoc, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    if (editingCenterId) {
                        await setDoc(doc(db, "centros_acopio_v4", editingCenterId), {
                            nombre,
                            necesidades,
                            estado,
                            updatedAt: new Date()
                        });
                        editingCenterId = null;
                        document.getElementById('btn-save-acopio').innerText = "GUARDAR CENTRO";
                    } else {
                        await addDoc(collection(db, "centros_acopio_v4"), {
                            nombre,
                            necesidades,
                            estado,
                            updatedAt: new Date()
                        });
                    }
                    acopioManagerForm.reset();
                } catch (err) {
                    alert("Error: " + err.message);
                }
            } else {
                let centers = JSON.parse(localStorage.getItem('nexus_mock_acopio') || JSON.stringify(defaultAcopioCenters));
                if (editingCenterId) {
                    centers = centers.map(c => {
                        if (c.id.toString() === editingCenterId.toString()) {
                            return { ...c, name: nombre, needs: necesidades, status: estado, updated: "Recién" };
                        }
                        return c;
                    });
                    editingCenterId = null;
                    document.getElementById('btn-save-acopio').innerText = "GUARDAR CENTRO";
                } else {
                    centers.unshift({
                        id: Date.now(),
                        name: nombre,
                        needs: necesidades,
                        status: estado,
                        updated: "Recién"
                    });
                }
                localStorage.setItem('nexus_mock_acopio', JSON.stringify(centers));
                acopioManagerForm.reset();
                updateAdminSimulationData();
                renderAcopioFeed(centers);
            }
        });

        // Admin Access Code Validation
        btnLoginAdmin.addEventListener('click', () => {
            const code = adminCodeInput.value.trim();
            if (code === 'NEXUS-ROOT-777') {
                isAdmin = true;
                isRoot = true;
                btnAdminTab.classList.remove('hidden');
                adminSettingsContainer.classList.remove('hidden');
                document.getElementById('rbac-panel').classList.remove('hidden');
                alert("Acceso ROOT Concedido. Tienes Mando Absoluto.");
                settingsPanel.classList.add('translate-x-full');
                adminCodeInput.value = '';
                
                if (isSimulationMode) {
                    updateAdminSimulationData();
                }
            } else {
                alert("Código de acceso táctico incorrecto.");
            }
        });

        document.getElementById('btn-assign-role').addEventListener('click', async () => {
            const rbacCed = document.getElementById('rbac-cedula').value.trim().toUpperCase();
            const rbacRole = document.getElementById('rbac-role').value;
            if (!rbacCed) return alert("Ingrese cédula");

            if (!isSimulationMode && db) {
                try {
                    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    await setDoc(doc(db, "roles_autoridad_v4", rbacCed), {
                        role: rbacRole,
                        grantedBy: "ROOT",
                        updatedAt: new Date().toISOString()
                    });
                    alert(`Rol ${rbacRole} asignado a ${rbacCed}`);
                    document.getElementById('rbac-cedula').value = '';
                } catch (err) {
                    alert("Error asignando rol: " + err.message);
                }
            } else {
                alert("Debes estar conectado a Firebase real para asignar roles de autoridad.");
            }
        });

        // Tab View Transitions
        btnAdminTab.addEventListener('click', () => {
            dashView.classList.add('hidden');
            authView.classList.add('hidden');
            adminView.classList.remove('hidden');
        });

        btnAdminExit.addEventListener('click', () => {
            adminView.classList.add('hidden');
            if (currentUser) {
                dashView.classList.remove('hidden');
                setTimeout(initMap, 500);
            } else {
                authView.classList.remove('hidden');
            }
        });

        // ==========================================
        // V2 ADITIONAL CAPABILITIES (MAPS, SENSOR, P2P MESH, ALERTS)
        // ==========================================

        // Initialize Leaflet Map (Dark theme tiles)
        function initMap() {
            if (map) return;
            try {
                // Coordinates for Plaza Bolívar Chacao
                map = L.map('map', { zoomControl: false }).setView([10.4936, -66.8524], 14);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; CartoDB',
                    maxZoom: 19
                }).addTo(map);
                
                // Add zoom control at top right
                L.control.zoom({ position: 'topright' }).addTo(map);
                console.log('[Leaflet Map] Inicializado con éxito.');
                
                // Load damage markers
                loadMapMarkers();
            } catch (err) {
                console.error('[Leaflet Map] Error al inicializar:', err);
            }
        }

        let mapMarkers = [];
        
        function loadMapMarkers() {
            if (!map) return;
            
            // Clear existing markers
            mapMarkers.forEach(m => map.removeLayer(m));
            mapMarkers = [];
            
            if (!isSimulationMode && db) {
                import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then(({ collection, query, onSnapshot }) => {
                    // Subscribe to Damage
                    const qDanio = query(collection(db, "reportes_danio_v4"));
                    onSnapshot(qDanio, (snapshot) => {
                        // For simplicity, we just clear and redraw all on any update
                        mapMarkers.forEach(m => map.removeLayer(m));
                        mapMarkers = [];
                        
                        snapshot.forEach((doc) => {
                            addMarkerToMap(doc.data());
                        });
                        
                        // Also redraw local or mock SOS for now, since we clear mapMarkers
                        const mockSosList = JSON.parse(localStorage.getItem('nexus_mock_sos') || '[]');
                        mockSosList.forEach(report => {
                            if (report.lat && report.lng) addSosMarkerToMap(report);
                        });
                    });
                    
                    // Subscribe to Live SOS Alerts
                    const qSos = query(collection(db, "alertas_sos_v4"));
                    onSnapshot(qSos, (snapshot) => {
                        // Clear markers maybe? Better just append them or rely on the combined redraw
                        // Since this is real time, let's just redraw SOS on top
                        snapshot.forEach((doc) => {
                            const data = doc.data();
                            if (data.lat && data.lng) {
                                addSosMarkerToMap(data);
                            }
                        });
                    });
                });
            } else {
                // Load local mock markers
                const mockDamageList = JSON.parse(localStorage.getItem('nexus_mock_damage') || '[]');
                mockDamageList.forEach(report => {
                    addMarkerToMap(report);
                });
                
                const mockSosList = JSON.parse(localStorage.getItem('nexus_mock_sos') || '[]');
                mockSosList.forEach(report => {
                    if (report.lat && report.lng) {
                        addSosMarkerToMap(report);
                    }
                });
            }
        }
        
        function addMarkerToMap(data) {
            if (!map) return;
            
            // Coordinates for Plaza Bolívar Chacao as center
            let lat = 10.4936;
            let lng = -66.8524;
            
            const sectorOffsets = {
                "Alrededores Plaza Bolivar": { lat: 10.4936, lng: -66.8524 },
                "Casco Central Chacao": { lat: 10.4925, lng: -66.8510 },
                "Bello Campo": { lat: 10.4880, lng: -66.8550 },
                "El Rosal": { lat: 10.4870, lng: -66.8610 },
                "Altamira": { lat: 10.4970, lng: -66.8480 },
                "Los Palos Grandes": { lat: 10.4980, lng: -66.8430 }
            };
            
            const offset = sectorOffsets[data.edificio] || { lat: 10.4936, lng: -66.8524 };
            // Add a small pseudo-random offset so markers don't overlap completely
            const seed = parseInt(data.timestamp ? data.timestamp.replace(/\D/g, '').substring(0, 6) : '0') || Math.random() * 10000;
            const pseudoRandomLat = offset.lat + (Math.sin(seed) * 0.0018);
            const pseudoRandomLng = offset.lng + (Math.cos(seed) * 0.0018);
            
            let color = '#22c55e'; // Green (1-3)
            if (data.nivel_danio > 3) color = '#f59e0b'; // Orange (4-6)
            if (data.nivel_danio > 7) color = '#ef4444'; // Red (7-10)
            
            const marker = L.circleMarker([pseudoRandomLat, pseudoRandomLng], {
                radius: Math.max(6, data.nivel_danio * 1.8),
                fillColor: color,
                color: color,
                weight: 1,
                opacity: 0.95,
                fillOpacity: 0.6
            }).addTo(map);
            
            marker.bindPopup(`
                <div class="text-xs text-nexusDark font-sans">
                    <p class="font-bold uppercase text-nexusNavyLight">${data.edificio || 'Desconocido'}</p>
                    <p class="font-mono mt-0.5 text-nexusRed font-black">Daño: ${data.nivel_danio || 1}/10</p>
                    ${data.comentarios ? `<p class="italic mt-1 text-[10px] text-gray-600">"${data.comentarios}"</p>` : ''}
                </div>
            `);
            
            mapMarkers.push(marker);
        }

        function addSosMarkerToMap(data) {
            if (!map || !data.lat || !data.lng) return;
            
            const sosIcon = L.divIcon({
                className: 'custom-sos-icon',
                html: `<div class="w-4 h-4 bg-nexusRed rounded-full shadow-sosPulse animate-ping"></div><div class="w-4 h-4 bg-nexusRed rounded-full absolute top-0 left-0"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            const marker = L.marker([data.lat, data.lng], {
                icon: sosIcon
            }).addTo(map);
            
            marker.bindPopup(`
                <div class="text-xs text-nexusDark font-sans text-center">
                    <p class="font-bold uppercase text-nexusRed border-b border-nexusRed pb-1 mb-1">⚠️ SOS ACTIVO</p>
                    <p class="font-bold">${data.nombre}</p>
                    <p class="font-mono text-[10px] text-gray-700 mt-1">C.I: ${data.cedula}</p>
                    <p class="font-mono text-[10px] text-gray-700">Grupo: ${data.habitantes} pers.</p>
                </div>
            `);
            
            mapMarkers.push(marker);
        }

        // Broadcast Authority Message Transmission
        btnSendAlert.addEventListener('click', async () => {
            const msg = adminMessage.value.trim();
            if (!msg) {
                alert("Por favor escribe un mensaje antes de transmitir.");
                return;
            }
            
            const alertData = {
                mensaje: msg,
                timestamp: new Date().toISOString()
            };

            if (!isSimulationMode && db) {
                try {
                    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    await addDoc(collection(db, "mensajes_acopio_v4"), alertData);
                    adminMessage.value = '';
                    alert("Mensaje oficial transmitido a todos los nodos en vivo.");
                } catch (err) {
                    alert("Error al enviar alerta a Firestore: " + err.message);
                }
            } else {
                // Simulation mode
                localStorage.setItem('nexus_mock_broadcast', JSON.stringify(alertData));
                broadcastMessageText.innerText = msg;
                broadcastAlert.classList.remove('hidden');
                adminMessage.value = '';
                alert("Mensaje simulado transmitido a la red local.");
            }
        });

        // Web Seismograph Event Listener (devicemotion sensor)
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', async (event) => {
                const acc = event.accelerationIncludingGravity;
                if (!acc) return;
                
                // Calculate G force acceleration
                const force = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
                
                // If acceleration force exceeds 15 m/s² (anomalous seismic activity)
                if (force > 15) {
                    seismicAlert.classList.remove('hidden');
                    
                    const sensorAlert = {
                        fuerza: force.toFixed(2),
                        timestamp: new Date().toISOString(),
                        usuario: currentUser ? currentUser.cedula : 'Anónimo'
                    };
                    
                    if (!isSimulationMode && db) {
                        try {
                            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                            await addDoc(collection(db, "alertas_sensores_v4"), sensorAlert);
                            console.log('[Sismógrafo] Alerta de temblor fuerte enviada a Firestore.');
                        } catch (err) {
                            console.warn('[Sismógrafo] Error enviando alerta sísmica:', err.message);
                        }
                    } else {
                        console.log('[Sismógrafo Simulador] Temblor detectado localmente:', force);
                    }
                    
                    // Hide after 6 seconds
                    setTimeout(() => {
                        seismicAlert.classList.add('hidden');
                    }, 6000);
                }
            });
        }

        // Active Mesh Node Simulator Loop
        function startMeshCounter() {
            setInterval(() => {
                const count = Math.floor(Math.random() * 31) + 15; // Random number between 15 and 45
                meshCountText.innerText = `${count} Nodos`;
            }, 8000);
            
            // Set initial value immediately
            const initialCount = Math.floor(Math.random() * 31) + 15;
            meshCountText.innerText = `${initialCount} Nodos`;
        }
        startMeshCounter();

        // REGISTER SERVICE WORKER FOR PWA SUPPORT WITH UPDATE DETECTION
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        console.log('[Service Worker] Registrado con éxito en el ámbito:', registration.scope);
                        
                        // Check for updates to the service worker code
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                // If a new worker is installed and there's already an active worker controlling the page
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[Service Worker] Nueva versión táctica detectada.');
                                    if (confirm("Hay una actualización crítica del sistema disponible. ¿Deseas recargar la aplicación para aplicarla de inmediato?")) {
                                        location.reload();
                                    }
                                }
                            });
                        });
                    })
                    .catch(err => {
                        console.error('[Service Worker] Registro fallido:', err);
                    });
            });
        }
    
