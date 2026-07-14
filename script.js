/* ============================================================
   ReelMind AI
   script.js
   Part 1A
   App Core + State + Navigation
============================================================ */

"use strict";

/* ==============================
   CONFIG
============================== */

const CONFIG = {

BACKEND_URL:
"https://ai-generator-z30l.onrender.com/api/generate",

DEMO_MODE:false,

UNLIMITED_CREDITS:true,

VERSION:"2.0.0"

};

/* ==============================
   APP STATE
============================== */

const App={

screen:"home",

model:"kling",

style:"cinematic",

duration:"8",

ratio:"9:16",

quality:"high",

fps:"30",

prompt:"",

negativePrompt:"",

credits:999999,

renders:0,

videoURL:null,

history:[],

library:[],

loading:false

};

/* ==============================
   HELPERS
============================== */

const $=(q)=>document.querySelector(q);

const $$=(q)=>document.querySelectorAll(q);

function sleep(ms){

return new Promise(r=>setTimeout(r,ms));

}

function randomID(){

return Math.random()

.toString(36)

.substring(2,12);

}

/* ==============================
   TOAST
============================== */

const toast=$("#toast");

function showToast(msg){

toast.textContent=msg;

toast.classList.add("show");

clearTimeout(showToast.timer);

showToast.timer=setTimeout(()=>{

toast.classList.remove("show");

},2200);

}

/* ==============================
   SCREEN NAVIGATION
============================== */

function showScreen(id){

$$(".screen").forEach(screen=>{

screen.classList.remove("active");

});

const page=document.getElementById(id);

if(page){

page.classList.add("active");

App.screen=id;

}

$$(".nav-btn,.nav-item").forEach(btn=>{

btn.classList.remove("active");

if(btn.dataset.screen===id){

btn.classList.add("active");

}

});

}

/* Sidebar */

$$(".nav-item").forEach(btn=>{

btn.onclick=()=>{

showScreen(btn.dataset.screen);

};

});

/* Bottom */

$$(".nav-btn").forEach(btn=>{

btn.onclick=()=>{

showScreen(btn.dataset.screen);

};

});

/* ==============================
   LOADING
============================== */

window.addEventListener("load",async()=>{

await sleep(1200);

const loading=$("#loadingScreen");

loading.style.opacity="0";

await sleep(500);

loading.remove();

});

/* ==============================
   HERO BUTTONS
============================== */

$("#newProject")?.addEventListener(

"click",

()=>{

showScreen("create");

}

);

$("#openLibrary")?.addEventListener(

"click",

()=>{

showScreen("library");

}

);

/* ==============================
   END PART 1A
============================== */

/* ============================================================
   ReelMind AI
   script.js
   Part 1B
   Models • Styles • Settings
============================================================ */

/* ==============================
   AI MODEL SELECTOR
============================== */

$$(".model-card").forEach(card=>{

card.addEventListener("click",()=>{

$$(".model-card").forEach(c=>{

c.classList.remove("active");

});

card.classList.add("active");

App.model=card.dataset.model;

showToast(
"Model: "+card.querySelector("h4").textContent
);

});

});

/* ==============================
   STYLE SELECTOR
============================== */

$$(".style-item").forEach(card=>{

card.onclick=()=>{

$$(".style-item").forEach(c=>{

c.classList.remove("active");

});

card.classList.add("active");

App.style=

card.innerText.trim().toLowerCase();

showToast(
"Style: "+card.innerText.trim()
);

};

});

/* ==============================
   SETTINGS
============================== */

const duration=$("#duration");

const ratio=$("#ratio");

const quality=$("#quality");

const fps=$("#fps");

duration?.addEventListener(

"change",

e=>{

App.duration=

e.target.value;

}

);

ratio?.addEventListener(

"change",

e=>{

App.ratio=

e.target.value;

}

);

quality?.addEventListener(

"change",

e=>{

App.quality=

e.target.value;

}

);

fps?.addEventListener(

"change",

e=>{

App.fps=

e.target.value;

}

);

/* ==============================
   MOTION BUTTONS
============================== */

App.motion="Static";

$$(".motion").forEach(btn=>{

btn.onclick=()=>{

$$(".motion").forEach(b=>{

b.classList.remove("active");

});

btn.classList.add("active");

App.motion=

btn.textContent.trim();

showToast(

"Motion: "+App.motion

);

};

});

/* ==============================
   NEGATIVE PROMPT
============================== */

const negativePrompt=

$("#negativePrompt");

negativePrompt?.addEventListener(

"input",

e=>{

App.negativePrompt=

e.target.value;

}

);

/* ==============================
   ADVANCED SETTINGS
============================== */

const sliders=

$$("input[type='range']");

sliders.forEach((slider,index)=>{

slider.addEventListener(

"input",

()=>{

if(index===0){

App.creativity=

slider.value;

}

else{

App.motionStrength=

slider.value;

}

}

);

});

/* Seed */

const seedInput=

document.querySelector(

"input[type='number']"

);

seedInput?.addEventListener(

"input",

()=>{

App.seed=

seedInput.value;

}

);

/* Output Name */

const outputInput=

document.querySelector(

"input[type='text']"

);

outputInput?.addEventListener(

"input",

()=>{

App.outputName=

outputInput.value;

}

);

/* ==============================
   FLOATING BUTTON
============================== */

$("#floatingGenerate")

?.addEventListener(

"click",

()=>{

showScreen("create");

$("#promptInput")

?.focus();

}

);

/* Mobile Generate */

$("#mobileGenerate")

?.addEventListener(

"click",

()=>{

showScreen("create");

});

/* ==============================
   END PART 1B
============================== */

/* ============================================================
   ReelMind AI
   script.js
   Part 1C
   Library • Explore • Profile • Voice • Image Upload
============================================================ */

/* ==============================
   LIBRARY
============================== */

const libraryGrid = $("#libraryGrid");

function renderLibrary() {

    if (!libraryGrid) return;

    libraryGrid.innerHTML = "";

    if (App.library.length === 0) {

        libraryGrid.innerHTML = `
        <div class="empty-library">
            <h3>No Videos Yet</h3>
            <p>Your generated videos will appear here.</p>
        </div>`;

        return;
    }

    App.library.forEach(video => {

        const card = document.createElement("div");

        card.className = "library-card";

        card.innerHTML = `
            <video
                src="${video.url}"
                muted
                loop
                playsinline>
            </video>

            <h3>${video.title}</h3>
        `;

        card.querySelector("video").play().catch(()=>{});

        card.onclick = () => {

            App.videoURL = video.url;

            $("#previewVideo").src = video.url;

            $("#videoTitle").textContent = video.title;

            showScreen("preview");

        };

        libraryGrid.appendChild(card);

    });

}

/* ==============================
   PROFILE
============================== */

function updateProfile(){

    const count = $("#renderCount");

    if(count){

        count.textContent = App.renders;

    }

}

/* ==============================
   EXPLORE FEED
============================== */

const demoFeed=[

{

title:"Cyberpunk Tokyo",

url:""

},

{

title:"Fantasy Forest",

url:""

},

{

title:"Cinematic Ocean",

url:""

}

];

function renderExplore(){

const feed=$("#feedContainer");

if(!feed) return;

feed.innerHTML="";

demoFeed.forEach(item=>{

const card=document.createElement("div");

card.className="feed-card";

card.innerHTML=`

<div class="feed-thumb"></div>

<div style="padding:20px">

<h3>${item.title}</h3>

<p>Trending AI Video</p>

</div>

`;

feed.appendChild(card);

});

}

renderExplore();

/* ==============================
   VOICE PROMPT
============================== */

$("#voicePrompt")

?.addEventListener(

"click",

()=>{

if(!("webkitSpeechRecognition" in window)){

showToast("Voice not supported");

return;

}

const recognition=

new webkitSpeechRecognition();

recognition.lang="en-US";

recognition.start();

showToast("Listening...");

recognition.onresult=e=>{

const text=

e.results[0][0].transcript;

promptInput.value=text;

App.prompt=text;

};

}

);

/* ==============================
   IMAGE UPLOAD
============================== */

const uploadInput=

document.createElement("input");

uploadInput.type="file";

uploadInput.accept="image/*";

$("#uploadImage")

?.addEventListener(

"click",

()=>{

uploadInput.click();

}

);

uploadInput.onchange=()=>{

if(uploadInput.files.length){

App.referenceImage=

uploadInput.files[0];

showToast(

uploadInput.files[0].name

);

}

};

/* ==============================
   PROMPT ENHANCER
============================== */

$("#enhancePrompt")

?.addEventListener(

"click",

()=>{

if(!App.prompt){

showToast("Enter prompt first");

return;

}

const enhanced=

`${App.prompt},
cinematic lighting,
8k,
ultra realistic,
high detail,
masterpiece,
professional composition`;

promptInput.value=enhanced;

App.prompt=enhanced;

showToast("Prompt enhanced");

}

);

/* ==============================
   LOCAL STORAGE
============================== */

function saveLocal(){

localStorage.setItem(

"reelmind-data",

JSON.stringify(App)

);

}

function loadLocal(){

const data=

localStorage.getItem(

"reelmind-data"

);

if(!data) return;

try{

Object.assign(

App,

JSON.parse(data)

);

}catch(e){

console.error(e);

}

}

window.addEventListener(

"beforeunload",

saveLocal

);

loadLocal();

updateProfile();

renderLibrary();

/* ==============================
   END PART 1C
============================== */

/* ============================================================
   ReelMind AI
   script.js
   PART 2
   Video Generation Engine
============================================================ */

/* ==============================
   GENERATION STATE
============================== */

let currentRequestId = null;
let currentVideoURL = null;
let isGenerating = false;

const progressModal = $("#renderModal");
const progressFill = $("#progressFill");
const progressText = $("#progressText");
const renderStatus = $("#renderStatus");

/* ==============================
   OPEN/CLOSE MODAL
============================== */

function openProgress() {

    progressModal?.classList.add("show");

    progressFill.style.width = "0%";

    progressText.textContent = "0%";

    renderStatus.textContent = "Preparing AI...";

}

function closeProgress() {

    progressModal?.classList.remove("show");

}

/* ==============================
   PROGRESS
============================== */

function updateProgress(percent, text) {

    progressFill.style.width = percent + "%";

    progressText.textContent = percent + "%";

    renderStatus.textContent = text;

}

/* ==============================
   BACKEND
============================== */

async function submitGeneration() {

    const response = await fetch(

        CONFIG.BACKEND_URL + "?action=submit",

        {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                prompt: App.prompt,

                duration: App.duration,

                aspect_ratio: App.ratio

            })

        }

    );

    if (!response.ok) {

        throw new Error("Unable to submit request");

    }

    return response.json();

}

/* ==============================
   STATUS
============================== */

async function checkStatus(id) {

    const response = await fetch(

        CONFIG.BACKEND_URL +

        "?action=status&request_id=" +

        encodeURIComponent(id)

    );

    if (!response.ok)

        throw new Error("Status failed");

    return response.json();

}

/* ==============================
   RESULT
============================== */

async function getResult(id) {

    const response = await fetch(

        CONFIG.BACKEND_URL +

        "?action=result&request_id=" +

        encodeURIComponent(id)

    );

    if (!response.ok)

        throw new Error("Result failed");

    return response.json();

}

/* ==============================
   POLLING
============================== */

async function waitUntilComplete(id) {

    let progress = 5;

    while (true) {

        await sleep(2500);

        const status = await checkStatus(id);

        progress = Math.min(progress + 8, 95);

        updateProgress(

            progress,

            "Rendering video..."

        );

        if (status.status === "COMPLETED") {

            return;

        }

        if (

            status.status === "FAILED" ||

            status.status === "ERROR"

        ) {

            throw new Error(

                "Generation failed"

            );

        }

    }

}

/* ==============================
   START GENERATION
============================== */

async function generateVideo() {

    if (isGenerating)

        return;

    if (!App.prompt.trim()) {

        showToast(

            "Enter a prompt"

        );

        return;

    }

    isGenerating = true;

    openProgress();

    try {

        updateProgress(

            10,

            "Sending prompt..."

        );

        const submit =

            await submitGeneration();

        currentRequestId =

            submit.request_id;

        updateProgress(

            25,

            "Queued..."

        );

        await waitUntilComplete(

            currentRequestId

        );

        updateProgress(

            98,

            "Downloading..."

        );

        const result =

            await getResult(

                currentRequestId

            );

        currentVideoURL =

            result.video?.url ||

            result.video_url;

        updateProgress(

            100,

            "Completed"

        );

        await sleep(500);

        closeProgress();

        previewResult();

    }

    catch (err) {

        closeProgress();

        console.error(err);

        showToast(err.message);

    }

    finally {

        isGenerating = false;

    }

}

/* ==============================
   GENERATE BUTTON
============================== */

$("#generateVideo")

?.addEventListener(

"click",

generateVideo

);

/* ==============================
   END PART 2
============================== */

/* ============================================================
   ReelMind AI
   script.js
   PART 3
   Preview • Download • Share • Library • Final
============================================================ */

/* ==============================
   PREVIEW
============================== */

const previewVideo = $("#previewVideo");
const videoTitle = $("#videoTitle");

function previewResult() {

    if (!currentVideoURL) {
        showToast("Video unavailable");
        return;
    }

    App.videoURL = currentVideoURL;

    previewVideo.src = currentVideoURL;
    previewVideo.load();

    previewVideo.play().catch(()=>{});

    videoTitle.textContent =
        App.outputName ||
        "AI Generated Video";

    showScreen("preview");

    saveVideo();

}

/* ==============================
   SAVE TO LIBRARY
============================== */

function saveVideo() {

    App.library.unshift({

        id: randomID(),

        title:
            App.outputName ||
            "Untitled",

        prompt: App.prompt,

        model: App.model,

        style: App.style,

        duration: App.duration,

        ratio: App.ratio,

        url: currentVideoURL,

        created:
            new Date().toLocaleString()

    });

    App.renders++;

    renderLibrary();

    updateProfile();

    saveLocal();

}

/* ==============================
   DOWNLOAD
============================== */

$("#downloadVideo")

?.addEventListener(

"click",

async()=>{

    if(!currentVideoURL){

        showToast("Nothing to download");

        return;

    }

    try{

        const response=
            await fetch(currentVideoURL);

        const blob=
            await response.blob();

        const url=
            URL.createObjectURL(blob);

        const a=
            document.createElement("a");

        a.href=url;

        a.download=
            (App.outputName||"video")+
            ".mp4";

        document.body.appendChild(a);

        a.click();

        a.remove();

        URL.revokeObjectURL(url);

        showToast("Download complete");

    }

    catch(e){

        window.open(
            currentVideoURL,
            "_blank"
        );

    }

});

/* ==============================
   SHARE
============================== */

$("#shareVideo")

?.addEventListener(

"click",

async()=>{

    if(!currentVideoURL) return;

    if(navigator.share){

        try{

            await navigator.share({

                title:"ReelMind AI",

                text:App.prompt,

                url:currentVideoURL

            });

        }

        catch(e){}

    }

    else{

        await navigator.clipboard.writeText(

            currentVideoURL

        );

        showToast(

            "Video link copied"

        );

    }

});

/* ==============================
   REGENERATE
============================== */

$("#regenerateVideo")

?.addEventListener(

"click",

()=>{

    generateVideo();

});

/* ==============================
   KEYBOARD SHORTCUTS
============================== */

window.addEventListener(

"keydown",

e=>{

    if(

        e.ctrlKey &&

        e.key==="Enter"

    ){

        generateVideo();

    }

    if(

        e.key==="Escape"

    ){

        closeProgress();

    }

});

/* ==============================
   RETRY
============================== */

async function retry(times,fn){

    let lastError;

    for(

        let i=0;

        i<times;

        i++

    ){

        try{

            return await fn();

        }

        catch(err){

            lastError=err;

            await sleep(1000);

        }

    }

    throw lastError;

}

/* ==============================
   AUTO SAVE
============================== */

setInterval(

saveLocal,

10000

);

/* ==============================
   WINDOW ONLINE/OFFLINE
============================== */

window.addEventListener(

"offline",

()=>{

showToast(

"You're offline"

);

});

window.addEventListener(

"online",

()=>{

showToast(

"Back online"

);

});

/* ==============================
   APP STARTUP
============================== */

document.addEventListener(

"DOMContentLoaded",

()=>{

    renderLibrary();

    renderExplore();

    updateProfile();

    loadLocal();

});

/* ==============================
   VERSION
============================== */

console.log(

"ReelMind AI",

CONFIG.VERSION,

"Loaded Successfully"

);

/* ==============================
   END OF FILE
============================================================ */
