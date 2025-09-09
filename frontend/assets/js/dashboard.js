// Lightweight dashboard behaviors: seed demo data, chat messages, and upload bubble + IndexedDB storage
(function(){
    // seed demo removed
    const chat = document.getElementById('chat');
    const promptInput = document.getElementById('prompt');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadBubble = document.getElementById('uploadBubble');
    const bubbleFilename = document.getElementById('bubbleFilename');
    const bubbleSize = document.getElementById('bubbleSize');
    const bubbleTime = document.getElementById('bubbleTime');

    function addAssistantMessage(html, meta){
        const div = document.createElement('div');
        div.className = 'msg assistant';
        div.innerHTML = html + `<div class="time">${new Date().toLocaleTimeString()}</div>`;
        // attach meta data (like response JSON) for save/edit
        if(meta) div.dataset.meta = JSON.stringify(meta);
    chat.appendChild(div);
    // ensure the new message is visible above the fixed composer
    setTimeout(()=> div.scrollIntoView({behavior:'smooth', block:'nearest'}), 50);
        // persist chat message
        saveChatMessage({role:'assistant', text:html, meta:meta});
        return div;
    }

    function addUserMessage(text){
        const div = document.createElement('div');
        div.className = 'msg user';
        div.textContent = text;
        div.innerHTML += `<div class="time">${new Date().toLocaleTimeString()}</div>`;
    chat.appendChild(div);
    setTimeout(()=> div.scrollIntoView({behavior:'smooth', block:'nearest'}), 50);
        saveChatMessage({role:'user', text:text});
    }

    // NOTE: Welcome message will be added only if DB is empty when loading saved chats.

    // pendingFile is set when user selects a file; actual save happens when user clicks Send
    let pendingFile = null;

    sendBtn.addEventListener('click', function(){
        const v = promptInput.value.trim();

        // If there's no text and no pending file, do nothing
        if(!v && !pendingFile) return;

        // Hide the file bubble immediately when sending
        uploadBubble.style.display = 'none';

        // Helper to show error
        function showError(msg) {
            addAssistantMessage(`<span style='color:red'>${msg}</span>`);
        }

        // If only prompt (no file)
        if (!pendingFile && v) {
            addUserMessage(v);
            promptInput.value = '';
            fetch('http://localhost:3004/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: v })
            })
            .then(r => {
                const contentType = r.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return r.json();
                } else {
                    throw new Error('Response is not JSON');
                }
            })
            .then(data => {
                if (data.ok && data.response) {
                    addAssistantMessage(data.response);
                } else {
                    showError(data.error || 'AI error');
                }
            })
            .catch(err => showError('Parsing error: ' + err));
            return;
        }

        // If file (with or without prompt)
        if (pendingFile) {
            // show user message
            if(v) {
                addUserMessage(`(With file: ${pendingFile.name}) ${v}`);
            } else {
                addUserMessage(`Uploaded file: ${pendingFile.name}`);
            }

            // Prepare form data
            const formData = new FormData();
            formData.append('file', pendingFile);
            // Optionally include prompt in formData if needed by backend
            if (v) formData.append('prompt', v);

            // Determine endpoint
            let endpoint = '';
            if (pendingFile.type.startsWith('image/')) {
                endpoint = '/api/parse-image';
            } else if (pendingFile.type === 'application/pdf') {
                endpoint = '/api/parse-pdf';
            } else {
                showError('Unsupported file type');
                return;
            }

            fetch('http://localhost:3004' + endpoint, {
                method: 'POST',
                body: formData
            })
            .then(r => {
                const contentType = r.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return r.json();
                } else {
                    throw new Error('Response is not JSON');
                }
            })
            .then(data => {
                if (data.ok && data.text) {
                    addAssistantMessage(`<pre>${data.text}</pre>`);
                } else if (data.ok && data.quiz) {
                    // Display quiz JSON from backend
                    showApiJsonEditor(addAssistantMessage('Quiz generated:', {}), data.quiz);
                } else {
                    showError(data.error || 'Parsing error');
                }
            })
            .catch(err => showError('Parsing error: ' + err))
                        .finally(() => {
                            pendingFile = null;
                            fileInput.value = '';
                            uploadBubble.style.display = 'none';
                            promptInput.value = '';
                            // Remove upload bubble from chat if present
                            const chat = document.getElementById('chat');
                            if (chat) {
                                const bubbleInChat = chat.querySelector('#uploadBubble');
                                if (bubbleInChat) {
                                    chat.removeChild(bubbleInChat);
                                }
                            }
                        });
        }
    });

    attachBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', handleFileSelection);

    // IndexedDB helpers
    function openDB(){
        // Ensure all pages create the same set of stores so any script can open and use them
        const requiredStores = ['quizzes','chats','attempts'];
        return new Promise((resolve,reject)=>{
            let req = indexedDB.open('quizDB');

            req.onupgradeneeded = e => {
                const db = e.target.result;
                // create missing stores
                if(!db.objectStoreNames.contains('quizzes')) db.createObjectStore('quizzes',{keyPath:'id'});
                if(!db.objectStoreNames.contains('chats')) db.createObjectStore('chats',{keyPath:'id'});
                if(!db.objectStoreNames.contains('attempts')) db.createObjectStore('attempts',{keyPath:'id'});
            };

            req.onsuccess = e => {
                const db = e.target.result;
                const missing = requiredStores.filter(s => !db.objectStoreNames.contains(s));
                if(missing.length === 0) {
                    resolve(db);
                    return;
                }
                // Need to close and reopen with a higher version to create missing stores
                const newVersion = db.version + 1;
                db.close();
                const upgradeReq = indexedDB.open('quizDB', newVersion);
                upgradeReq.onupgradeneeded = ev => {
                    const upgradedDb = ev.target.result;
                    if(!upgradedDb.objectStoreNames.contains('quizzes')) upgradedDb.createObjectStore('quizzes',{keyPath:'id'});
                    if(!upgradedDb.objectStoreNames.contains('chats')) upgradedDb.createObjectStore('chats',{keyPath:'id'});
                    if(!upgradedDb.objectStoreNames.contains('attempts')) upgradedDb.createObjectStore('attempts',{keyPath:'id'});
                };
                upgradeReq.onsuccess = ev2 => resolve(ev2.target.result);
                upgradeReq.onerror = ev2 => reject(ev2.target.error);
            };

            req.onerror = e => reject(e.target.error);
        });
    }

    function saveQuizToIDB(quiz){
        return openDB().then(db => new Promise((resolve,reject)=>{
            const tx = db.transaction('quizzes','readwrite');
            const store = tx.objectStore('quizzes');
            const req = store.put(quiz);
            req.onsuccess = ()=> resolve(req.result);
            req.onerror = e => reject(e.target.error);
        }));
    }

    // save chat messages into `chats` store; simple append model: id is timestamp
    function saveChatMessage(msg){
        const id = 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        const entry = Object.assign({id:id}, msg, {timestamp: Date.now()});
        // Save locally first
        return openDB().then(db => new Promise((resolve,reject)=>{
            const tx = db.transaction('chats','readwrite');
            const store = tx.objectStore('chats');
            const req = store.put(entry);
            req.onsuccess = ()=> resolve(req.result);
            req.onerror = e => reject(e.target.error);
        })).then(res=>{
            // best-effort: also push to server
            try{ saveChatMessageToServer(entry).catch(()=>{}); }catch(e){}
            return res;
        }).catch(err=>{
            // If local save failed, still try server
            try{ saveChatMessageToServer(entry).catch(()=>{}); }catch(e){}
            throw err;
        });
    }

    // Also try to persist chat to server (best-effort)
    function saveChatMessageToServer(msg){
        try{
            const serverUrl = 'http://localhost:3004/api/chats';
            const teacherId = localStorage.getItem('teacherId');
            const payload = Object.assign({}, msg, { teacherId });
            return fetch(serverUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json());
        }catch(e){ return Promise.reject(e); }
    }

    // On DOM ready: load saved chats from the existing quizDB `chats` store.
    document.addEventListener('DOMContentLoaded', function(){
        // wire Enter -> send (preserve existing behavior)
        document.getElementById('prompt').addEventListener('keydown', function(e){
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('sendBtn').click();
            }
        });

            // --- Publish Modal Logic ---
            const publishBtn = document.getElementById('publishBtn');
            const publishModal = document.getElementById('publishModal');
            const courseSelect = document.getElementById('courseSelect');
            const nextToStudents = document.getElementById('nextToStudents');
            const publishStep1 = document.getElementById('publishStep1');
            const publishStep2 = document.getElementById('publishStep2');
            const studentSelect = document.getElementById('studentSelect');
            const publishConfirm = document.getElementById('publishConfirm');
            const backToCourse = document.getElementById('backToCourse');
            const closePublishModal = document.getElementById('closePublishModal');

            // Fetch courses from backend and populate dropdown
            function loadCourses() {
              fetch('http://localhost:3004/api/courses?teacherId=' + localStorage.getItem('teacherId'))
                .then(r => r.json())
                .then(j => {
                  if (j.ok && Array.isArray(j.courses)) {
                    courseSelect.innerHTML = '<option value="">--Choose a course--</option>' +
                      j.courses.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
                  }
                });
            }

            // Fetch students for a course from backend and populate dropdown
            function loadStudents(courseId) {
              fetch('http://localhost:3004/api/courses/' + courseId + '/students')
                .then(r => r.json())
                .then(j => {
                  if (j.ok && Array.isArray(j.students)) {
                    // Add 'Select All' option
                    studentSelect.innerHTML = `<option value="__all__">Select All Students</option>` +
                      j.students.map(s => `<option value="${s._id}">${s.name}</option>`).join('');
                  }
                });
            }

            if (publishBtn) {
                publishBtn.addEventListener('click', function() {
                    publishModal.style.display = 'block';
                    publishStep1.style.display = 'block';
                    publishStep2.style.display = 'none';
                    loadCourses(); // Populate courses dynamically
                });
            }
            if (closePublishModal) {
                closePublishModal.onclick = function() {
                    publishModal.style.display = 'none';
                };
            }
            if (nextToStudents) {
                nextToStudents.onclick = function() {
                    const courseId = courseSelect.value;
                    if (!courseId) { alert('Please select a course.'); return; }
                    publishStep1.style.display = 'none';
                    publishStep2.style.display = 'block';
                    loadStudents(courseId); // Populate students dynamically
                };
            }
            if (backToCourse) {
                backToCourse.onclick = function() {
                    publishStep2.style.display = 'none';
                    publishStep1.style.display = 'block';
                };
            }
            if (publishConfirm) {
                publishConfirm.onclick = function() {
                    const courseId = courseSelect.value;
                    let selected = Array.from(studentSelect.selectedOptions).map(o => o.value);
                    // If 'Select All' is chosen, select all students except the '__all__' option
                    if (selected.includes('__all__')) {
                      selected = Array.from(studentSelect.options)
                        .filter(o => o.value !== '__all__')
                        .map(o => o.value);
                    }
                    if (selected.length === 0) { alert('Please select at least one student.'); return; }
                    alert(`Published quiz to course: ${courseId}, students: ${selected.join(', ')}`);
                    publishModal.style.display = 'none';
                };
            }

        openDB().then(db => {
            loadChatsFromIDB(db).then(count => {
                if(count === 0){
                    // no saved chats, add a welcome assistant message
                    const welcome = `Hello! I'm your AI teaching assistant. I can help you analyze student performance, create educational content, or answer questions about your courses. Feel free to upload PDFs or images for analysis.`;
                    addAssistantMessage(welcome);
                }
            }).catch(err => {
                console.error('Failed to load chats:', err);
            });
        }).catch(err => console.error('Failed to open DB:', err));
        // If local DB had no chats, try server fallback
    const teacherId = localStorage.getItem('teacherId');
    fetch(`http://localhost:3004/api/chats?teacherId=${teacherId}`)
        .then (r=>r.json())
        .then(j=>{
            if(j && j.ok && Array.isArray(j.chats) && j.chats.length){
                // clear current chat and render server chats
                chat.innerHTML = '';
                j.chats.forEach(e=>{
                    const div = document.createElement('div');
                    div.className = 'msg ' + (e.role === 'assistant' ? 'assistant' : 'user');
                    if(e.role === 'assistant') div.innerHTML = (e.text||'') + `<div class="time">${new Date(e.timestamp).toLocaleTimeString()}</div>`;
                    else { div.textContent = e.text||''; div.innerHTML += `<div class="time">${new Date(e.timestamp).toLocaleTimeString()}</div>`; }
                    if(e.meta) div.dataset.meta = JSON.stringify(e.meta);
                    chat.appendChild(div);
                });
            }
        }).catch(()=>{/* ignore server fallback errors */});
    });

    // Load messages saved in the `chats` store and render them preserving innerHTML and meta
    function loadChatsFromIDB(db){
        return new Promise((resolve,reject)=>{
            try{
                const tx = db.transaction('chats','readonly');
                const store = tx.objectStore('chats');
                const req = store.getAll();
                req.onsuccess = ()=>{
                    const entries = (req.result || []).sort((a,b)=> (a.timestamp||0) - (b.timestamp||0));
                    // clear current chat area
                    chat.innerHTML = '';
                    entries.forEach(e=>{
                        const div = document.createElement('div');
                        div.className = 'msg ' + (e.role === 'assistant' ? 'assistant' : 'user');
                        // restore assistant HTML as-is; user text should be escaped
                        if(e.role === 'assistant'){
                            // e.text likely contains HTML
                            div.innerHTML = (e.text || '') + `<div class="time">${new Date((e.timestamp||Date.now())).toLocaleTimeString()}</div>`;
                        } else {
                            div.textContent = e.text || '';
                            div.innerHTML += `<div class="time">${new Date((e.timestamp||Date.now())).toLocaleTimeString()}</div>`;
                        }
                        // preserve meta if present
                        if(e.meta) div.dataset.meta = JSON.stringify(e.meta);
                        chat.appendChild(div);
                    });
                    // scroll to bottom
                    chat.scrollTop = chat.scrollHeight;
                    resolve(entries.length);
                };
                req.onerror = ()=> reject(req.error || new Error('Failed to read chats'));
            }catch(err){ reject(err); }
        });
    }

    // helper: show API JSON editor and preview controls
    function showApiJsonEditor(parentDiv, jsonObj){
        // create editor area below the assistant message
        const container = document.createElement('div');
        container.className = 'api-json-container';
        const editor = document.createElement('div');
        editor.className = 'json-editor';
        editor.contentEditable = true;
        const pretty = JSON.stringify(jsonObj, null, 2);
        editor.textContent = pretty;
        container.appendChild(editor);
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn secondary';
    saveBtn.textContent = 'Save JSON';
    const previewBtn = document.createElement('button');
    previewBtn.className = 'btn';
    previewBtn.textContent = 'Preview Quiz';
    const genLinkBtn = document.createElement('button');
    genLinkBtn.className = 'btn';
    genLinkBtn.textContent = 'Generate Link';
        const publishBtn = document.createElement('button');
        publishBtn.className = 'btn';
        publishBtn.textContent = 'Publish';
        actions.appendChild(saveBtn);
        actions.appendChild(previewBtn);
    actions.appendChild(genLinkBtn);
        actions.appendChild(publishBtn);
        container.appendChild(actions);
        parentDiv.appendChild(container);

        saveBtn.addEventListener('click', ()=>{
            try{
                const edited = JSON.parse(editor.textContent);
                // Ensure quiz JSON has a unique id
                if (!edited.id) {
                    edited.id = 'quiz_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
                }
                // update stored meta on the assistant message DOM node
                parentDiv.dataset.meta = JSON.stringify(edited);
                addAssistantMessage('Saved edited JSON.');
                // Persist the edited JSON to server as a draft (best-effort)
                const meta = parentDiv.dataset.meta ? JSON.parse(parentDiv.dataset.meta) : null;
                const quizId = meta && meta.id ? meta.id : (edited && edited.id ? edited.id : null);
                if(quizId){
                    saveQuizDraftToServer(quizId, edited).catch(()=>{});
                }
            }catch(e){
                addAssistantMessage('Invalid JSON: ' + e.message);
            }
        });

        previewBtn.addEventListener('click', ()=>{
            try{
                const edited = JSON.parse(editor.textContent);
                openPreviewModal(edited);
            }catch(e){
                addAssistantMessage('Invalid JSON: ' + e.message);
            }
        });

        // Generate link: save finalized JSON into quizzes store (associate with existing blob if present)
        genLinkBtn.addEventListener('click', ()=>{
            try{
                const edited = JSON.parse(editor.textContent);
                // Ensure quiz JSON has a unique id
                if (!edited.id) {
                    edited.id = 'quiz_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
                }
                // the parentDiv should have meta with id (saved earlier)
                const meta = parentDiv.dataset.meta ? JSON.parse(parentDiv.dataset.meta) : null;
                const quizId = meta && meta.id ? meta.id : edited.id;
                if(!quizId){
                    addAssistantMessage('Unable to generate link: missing quiz id in message meta.');
                    return;
                }
                // fetch existing quiz entry to get the blob if present
                openDB().then(db => new Promise((resolve,reject)=>{
                    const tx = db.transaction('quizzes','readonly');
                    const store = tx.objectStore('quizzes');
                    const req = store.get(quizId);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = e => reject(e.target.error);
                })).then(existing => {
                    // attach content.src to point to placeholder; quiz.html will resolve to blob URL
                    edited.id = quizId;
                    // Save finalized JSON alongside the file blob so quiz.html can load it
                    const finalEntry = Object.assign({}, existing || {}, { id: quizId, finalizedJson: edited });
                    return saveQuizToIDB(finalEntry).then(()=> finalEntry);
                }).then(finalEntry => {
                    // Try to POST the finalized quiz to the server so other browsers can fetch it
                    const serverUrl = 'http://localhost:3004/api/quizzes';
                    const form = new FormData();
                    form.append('id', finalEntry.id);
                    form.append('finalizedJson', JSON.stringify(edited));
                    if(finalEntry.file) {
                        try{ form.append('file', finalEntry.file); }catch(e){ /* file may be a blob-like object */ }
                    }
                    // Try FormData first, then fallback to JSON if that fails
                    fetch(serverUrl, { method: 'POST', body: form }).then(r=>r.json()).then(j=>{
                        const shareableLink = `${window.location.origin}/quiz.html?id=${finalEntry.id}`;
                        addAssistantMessage(`Finalized quiz saved to server. Shareable link: <code id="lastLink">${shareableLink}</code>`);
                    }).catch(err=>{
                        console.warn('FormData upload failed, falling back to JSON:', err);
                        // fallback: send JSON containing finalizedJson and metadata (no file)
                        const teacherId = localStorage.getItem('teacherId');
                        fetch(serverUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: finalEntry.id, finalizedJson: edited, metadata: { title: edited.title }, teacherId }) }).then(r=>r.json()).then(j=>{
                            const shareableLink = `${window.location.origin}/quiz.html?id=${finalEntry.id}`;
                            addAssistantMessage(`Finalized quiz saved to server (no file). Shareable link: <code id="lastLink">${shareableLink}</code>`);
                        }).catch(err2=>{
                            console.warn('JSON fallback failed too:', err2);
                            const shareableLink = `${window.location.origin}/quiz.html?id=${finalEntry.id}`;
                            addAssistantMessage(`Finalized quiz saved locally. Shareable link: <code id="lastLink">${shareableLink}</code>`);
                        });
                    });
                }).catch(err => {
                    console.error('Generate link failed', err);
                    addAssistantMessage('Failed to generate link. See console for details.');
                });
            }catch(e){
                addAssistantMessage('Invalid JSON: ' + e.message);
            }
        });
            // Publish button: open the publish modal
            publishBtn.addEventListener('click', ()=>{
                const publishModal = document.getElementById('publishModal');
                const publishStep1 = document.getElementById('publishStep1');
                const publishStep2 = document.getElementById('publishStep2');
                if (publishModal && publishStep1 && publishStep2) {
                    publishModal.style.display = 'block';
                    publishStep1.style.display = 'block';
                    publishStep2.style.display = 'none';
                }
            });
        // When the editor is first shown, also persist this draft to the server so it's available cross-browser
        try{
            const metaOnParent = parentDiv.dataset.meta ? JSON.parse(parentDiv.dataset.meta) : null;
            const possibleId = metaOnParent && metaOnParent.id ? metaOnParent.id : (jsonObj && jsonObj.id ? jsonObj.id : null);
            if(possibleId){
                saveQuizDraftToServer(possibleId, jsonObj).catch(()=>{});
            }
        }catch(e){}
    }

    // Persist a quiz draft/finalizedJson to the server (best-effort)
    function saveQuizDraftToServer(quizId, finalizedJson){
        try{
            const serverUrl = 'http://localhost:3004/api/quizzes';
            const teacherId = localStorage.getItem('teacherId');
            // send as JSON (no file) for drafts
            return fetch(serverUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: quizId, finalizedJson: finalizedJson, metadata: { title: finalizedJson.title || null }, teacherId }) }).then(r=>r.json());
        }catch(e){ return Promise.reject(e); }
    }

    function openPreviewModal(quizJson){
        const modal = document.getElementById('previewModal');
        const previewArea = document.getElementById('previewArea');
        previewArea.innerHTML = '';
        // render minimal quiz preview
        const card = document.createElement('div');
        card.className = 'card';
        const title = document.createElement('h3');
        title.textContent = quizJson.title || 'Quiz Preview';
        card.appendChild(title);
        if(quizJson.content && quizJson.content.type && quizJson.content.src){
            if(quizJson.content.type === 'image'){
                const img = document.createElement('img');
                img.src = quizJson.content.src;
                img.style.maxWidth = '100%';
                card.appendChild(img);
            }else if(quizJson.content.type === 'pdf'){
                const emb = document.createElement('embed');
                emb.src = quizJson.content.src;
                emb.type = 'application/pdf';
                emb.style.width='100%';emb.style.height='400px';
                card.appendChild(emb);
            }
        }
        if(Array.isArray(quizJson.questions)){
            const qwrap = document.createElement('div');
            let currentPage = 0;
            const pageSize = 5;
            function renderPage() {
                qwrap.innerHTML = '';
                const start = currentPage * pageSize;
                const end = Math.min(start + pageSize, quizJson.questions.length);
                for(let idx = start; idx < end; idx++) {
                    const q = quizJson.questions[idx];
                    const qdiv = document.createElement('div');
                    qdiv.className = 'input-area';
                    const questionText = q.question || q.prompt || 'No question text';
                    qdiv.innerHTML = `<p>${idx+1}. ${questionText}</p>` + (q.type === 'text' ? `<input type="text" />` : `<textarea></textarea>`);
                    qwrap.appendChild(qdiv);
                }
            }
            renderPage();
            // Pagination controls
            const controls = document.createElement('div');
            controls.style.marginTop = '16px';
            controls.style.textAlign = 'center';
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Previous';
            prevBtn.disabled = true;
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            nextBtn.disabled = quizJson.questions.length <= pageSize;
            prevBtn.onclick = function() {
                if(currentPage > 0) {
                    currentPage--;
                    renderPage();
                    nextBtn.disabled = false;
                    prevBtn.disabled = currentPage === 0;
                }
            };
            nextBtn.onclick = function() {
                if((currentPage + 1) * pageSize < quizJson.questions.length) {
                    currentPage++;
                    renderPage();
                    prevBtn.disabled = false;
                    nextBtn.disabled = (currentPage + 1) * pageSize >= quizJson.questions.length;
                }
            };
            controls.appendChild(prevBtn);
            controls.appendChild(nextBtn);
            card.appendChild(qwrap);
            card.appendChild(controls);
        }
        previewArea.appendChild(card);
        document.getElementById('previewModal').style.display = 'flex';
    }

    document.getElementById('closePreview').addEventListener('click', ()=>{
        document.getElementById('previewModal').style.display = 'none';
    });

    // When a file is selected, keep it pending until the user clicks Send
    function handleFileSelection(e){
        const file = e.target.files && e.target.files[0];
        if(!file) return;
        pendingFile = file;

    // show floating bubble while pending
        bubbleFilename.textContent = file.name;
        bubbleSize.textContent = formatBytes(file.size);
        bubbleTime.textContent = new Date().toLocaleTimeString();
        uploadBubble.style.display = 'block';

    // make sure bubble and chat area are visible
    setTimeout(()=> uploadBubble.scrollIntoView({behavior:'smooth', block:'end'}), 100);

        // leave the bubble visible until send (or for a longer time)
        setTimeout(()=>{
            if(pendingFile) uploadBubble.style.display = 'block';
        }, 500);
    }

    function formatBytes(bytes){
        if(bytes===0) return '0 B';
        var k=1024,dm=2,sizes=['B','KB','MB','GB','TB'];
        var i=Math.floor(Math.log(bytes)/Math.log(k));
        return parseFloat((bytes/Math.pow(k,i)).toFixed(dm))+' '+sizes[i];
    }

    // Example: when sending a chat message (add teacherId)
function sendChatMessage(message, file) {
  const token = localStorage.getItem('token');
    const teacherId = localStorage.getItem('teacherId');
  const payload = {
    teacherId,
    message,
    file
  };
  fetch('http://localhost:3004/api/chats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    // handle response
  });
}

})();
