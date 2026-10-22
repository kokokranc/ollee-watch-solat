// Subscribe to Short press of A button, L button, and minute updates to check for new days or travel changes
const subscribe = E_A_SHORT + E_L_SHORT + E_CLOCK_HOUR;

// State management variables - RAM caching system
const P_TAGS = ["FJ", "RI", "DH", "AS ", "1N", "IS"];
const cachedTimes = ["0000", "0000", "0000", "0000", "0000", "0000"];
let currentPrayerIdx = 0;

// Dynamic check state variables to block redundant daily equations
let lastCachedDay = -1;
let lastLat = 0;
let lastLon = 0;
let lastTz = 999;

function init() {
    currentPrayerIdx = 0;
    lastCachedDay = -1;
}

function enter() {
    // Attempt evaluation check immediately upon opening the face
    checkAndComputeTimes();
    displayCurrentPrayer();
}

function exit() {
}

// Button cycles instantly out of memory arrays (0% math energy cost)
function a_short() {
    Ollee.beep();
    currentPrayerIdx = (currentPrayerIdx + 1) % 6; 
    displayCurrentPrayer();
}

function l_short() {
    currentPrayerIdx = 0;
    displayCurrentPrayer();
}

// Background minute tick checks if a new day has arrived or location changed
function clock_hour() {
    if (checkAndComputeTimes()) {
        displayCurrentPrayer(); // Only redraw if the cache actually shifted
    }
}

function displayCurrentPrayer() {
    Ollee.clear();
    Ollee.drawColon(1);
    Ollee.drawMain(cachedTimes[currentPrayerIdx] + P_TAGS[currentPrayerIdx]); 
}

function checkAndComputeTimes() {
    // 1. Fetch live metrics from hardware environment parameters
    /*const lat = Ollee.latitude() || 5.33;   
    const lon = Ollee.longitude() || 103.14; 
    const timeZoneOffset = Ollee.tz_offset;
    */
    
    // temp:
    // --- PROFILE SELECTION ---
    /* CANBERRA (Southern Hemisphere)
    const lat = -35.282;
    const lon = 149.129;
    const timeZoneOffset = 11;
    */

    /* TORONTO (Northern Hemisphere)
    const lat = 43.651070;
    const lon = -79.347015;
    const timeZoneOffset = -4;
    */

    /* KT
    const lat = 5.33;   
    const lon = 103.14; 
    const timeZoneOffset = 8;
    */

    /* KMM
    const lat = 4.2338;   
    const lon = 103.3638; 
    const timeZoneOffset = 8;
    */

    /* Putrajaya
    const lat = 2.9264;   
    const lon = 101.6964; 
    const timeZoneOffset = 8;
    */

    /*makkah
    const lat = 21.4225;
    const lon = 39.8262;
    const timeZoneOffset = 3;
    */

    // los angeles
    const lat = 34.052235;
    const lon = -118.243683;
    const timeZoneOffset = -7;
    

    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000); 

    // ENERGY GATEKEEPER: Stop equations if it is the same day and location hasn't changed
    if (dayOfYear === lastCachedDay && lat === lastLat && lon === lastLon && timeZoneOffset === lastTz) {
        return false; // Skip entire block completely to conserve battery power
    }

    // Update state tracking values to anchor the new gate boundaries
    lastCachedDay = dayOfYear;
    lastLat = lat;
    lastLon = lon;
    lastTz = timeZoneOffset;

    const isSouthernHemisphere = lat < 0;
    const absLat = Math.abs(lat); 

    // 2. Dynamic Geofencing Profile Analysis Matrix
    let fajrAngle = 18.0;
    let ishaAngle = 18.0;
    let ishaIntervalMinutes = 0; 
    let asrShadowMultiplier = 1; 

    if (absLat > 0 && absLat < 8 && lon > 99 && lon < 120) {
        // MALAYSIA (JAKIM Standard)
        fajrAngle = 18.0;
        ishaAngle = 18.0;
    } else if (lat > 24 && lat < 49 && lon > -125 && lon < -66) {
        // NORTH AMERICA (ISNA Standard)
        fajrAngle = 15.0;
        ishaAngle = 15.0;
    } else if (lat > 20 && lat < 32 && lon > 34 && lon < 50) {
        // SAUDI ARABIA (Umm al-Qura Standard)
        fajrAngle = 18.5;
        ishaIntervalMinutes = 90; 
    } else if (isSouthernHemisphere && absLat > 10 && absLat < 39 && lon > 113 && lon < 154) {
        // AUSTRALIA (Muslim World League Standard)
        fajrAngle = 18.0;
        ishaAngle = 17.0; 
    }

//LOG
log(fajrAngle);
log(ishaAngle);

    // 3. Pre-compute Radian Layout Parameters
    const latRad = (absLat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);

    const b = (2 * Math.PI * (dayOfYear - 81)) / 365;
    const eqt = (9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)) / 60;
    
    const solarDay = isSouthernHemisphere ? (dayOfYear + 182) : dayOfYear;
    const declination = ((23.45 * Math.sin((360 / 365) * (solarDay - 80) * Math.PI / 180)) * Math.PI) / 180;
    const sinDec = Math.sin(declination);
    const cosDec = Math.cos(declination);

    const dhuhrDecimal = 12 + timeZoneOffset - (lon / 15) - eqt;

    function getHourAngle(angle, morning) {
        const altRad = (-angle * Math.PI) / 180;
        const cosH = (Math.sin(altRad) - sinLat * sinDec) / (cosLat * cosDec);
        if (cosH > 1 || cosH < -1) return dhuhrDecimal + (morning ? -1.5 : 6);
        const H = Math.acos(cosH) * 180 / Math.PI / 15;
        return morning ? (dhuhrDecimal - H) : (dhuhrDecimal + H);
    }

    // 4. Calculate everything into memory fields sequentially
    let time = 0;
    for (let idx = 0; idx < 6; idx++) {
        switch(idx) {
            case 0: // FAJR
                time = getHourAngle(fajrAngle, true);
                break;
            case 1: // RISE
                time = getHourAngle(0.833, true);
                break;
            case 2: // DHUR
                time = dhuhrDecimal + 0.0166; 
                break;
            case 3: // ASR
                const shadowDiff = asrShadowMultiplier + Math.abs(Math.tan(latRad - declination));
                const asrAltRad = Math.atan(1 / shadowDiff);
                const cosH_Asr = (Math.sin(asrAltRad) - sinLat * sinDec) / (cosLat * cosDec);
                const asrH = (cosH_Asr >= -1 && cosH_Asr <= 1) ? Math.acos(cosH_Asr) * 180 / Math.PI / 15 : 3;
                time = dhuhrDecimal + asrH;
                break;
            case 4: // MAGR
                time = getHourAngle(0.833, false);
                break;
            case 5: // ISHA
                time = (ishaIntervalMinutes > 0) ? (getHourAngle(0.833, false) + 1.5) : getHourAngle(ishaAngle, false);
                break;
        }

        time = (time + 24) % 24;
        let hours = Math.floor(time);
        let minutes = Math.round((time - hours) * 60);
        
        if (minutes === 60) {
            minutes = 0;
            hours = (hours + 1) % 24;
        }

        const hStr = hours < 10 ? "0" + hours : "" + hours;
        const mStr = minutes < 10 ? "0" + minutes : "" + minutes;
        cachedTimes[idx] = hStr + mStr;
    }
    return true; 
}
