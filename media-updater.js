const fadeDelay = 200,
  axios = require("axios"),
  escape = require("escape-html"),
  i18n = require("i18n"),
  log = {
    debug: function() {
      let now = + new Date();
      if (!logOutput.debug[now]) logOutput.debug[now] = [];
      logOutput.debug[now].push(arguments);
      if (logLevel == "debug") console.log.apply(console,arguments);
    },
    error: function() {
      let now = + new Date();
      if (!logOutput.error[now]) logOutput.error[now] = [];
      logOutput.error[now].push(arguments);
      console.error.apply(console,arguments);
    },
    info: function() {
      let now = + new Date();
      if (!logOutput.info[now]) logOutput.info[now] = [];
      logOutput.info[now].push(arguments);
      console.info.apply(console,arguments);
    },
    warn: function() {
      let now = + new Date();
      if (!logOutput.warn[now]) logOutput.warn[now] = [];
      logOutput.warn[now].push(arguments);
      console.warn.apply(console,arguments);
    },
  },
  net = require("net"),
  os = require("os"),
  path = require("path"),
  remote = require("@electron/remote"),
  {shell} = require("electron"),
  $ = require("jquery");
function checkInternet(online) {
  if (online) {
    overlay(true, "cog fa-spin");
    require("electron").ipcRenderer.send("autoUpdate");
  } else {
    overlay(true, "wifi fa-beat", "circle-notch fa-spin text-danger");
    setTimeout(updateOnlineStatus, 4000);
  }
}
i18n.configure({
  directory: path.join(__dirname, "locales"),
  defaultLocale: "en",
  updateFiles: false,
  retryInDefaultLocale: true
});
const updateOnlineStatus = async () => checkInternet((await isReachable("www.jw.org", 443)));
updateOnlineStatus();
require("electron").ipcRenderer.on("overlay", (event, message) => overlay(true, message[0], message[1]));
require("electron").ipcRenderer.on("macUpdate", () => {
  $("#bg-mac-update").fadeIn(fadeDelay);
  $("#btn-settings").addClass("in-danger");
  $("#version").addClass("btn-danger in-danger").removeClass("btn-light").find("i").remove().end().prepend("<i class='fas fa-hand-point-right'></i> ").append(" <i class='fas fa-hand-point-left'></i>").click(function() {
    shell.openExternal("https://github.com/sircharlo/jw-meeting-media-fetcher/releases/latest");
  });
});
require("electron").ipcRenderer.on("goAhead", () => {
  goAhead();
});
const aspect = require("aspectratio"),
  bootstrap = require("bootstrap"),
  currentAppVersion = "v" + remote.app.getVersion(),
  dayjs = require("dayjs"),
  ffmpeg = require("fluent-ffmpeg"),
  fs = require("graceful-fs"),
  fullHd = [1920, 1080],
  glob = require("glob"),
  isImage = require("is-image"),
  isVideo = require("is-video"),
  hme = require("h264-mp4-encoder"),
  datetime = require("flatpickr"),
  sizeOf = require("image-size"),
  sqljs = require("sql.js"),
  v8 = require("v8"),
  {XMLParser} = require("fast-xml-parser"),
  zipper = require("adm-zip");

const bugUrl = () => "https://github.com/sircharlo/jw-meeting-media-fetcher/issues/new?labels=bug,from-app&title=ISSUE DESCRIPTION HERE&body=" + encodeURIComponent("### Describe the bug\nA clear and concise description of what the bug is.\n\n### To Reproduce\nSteps to reproduce the behavior:\n1. Go to '...'\n2. Click on '....'\n3. Do '....'\n4. See error\n\n### Expected behavior\nA clear and concise description of what you expected to happen.\n\n### Screenshots\nIf possible, add screenshots to help explain your problem.\n\n### System specs\n- " + os.type() + " " + os.release() + "\n- JWMMF v" + remote.app.getVersion() + "\n\n### Additional context\nAdd any other context about the problem here.\n" + (prefs ? "\n### Anonymized `prefs.json`\n```\n" + JSON.stringify(Object.fromEntries(Object.entries(prefs).map(entry => {
  if ((entry[0].startsWith("congServer") || entry[0] == "localOutputPath") && entry[1]) entry[1] = "***";
  return entry;
})), null, 2) + "\n```" : "") + (logOutput.error && logOutput.error.length >0 ? "\n### Full error log\n```\n" + JSON.stringify(logOutput.error, null, 2) + "\n```" : "") + "\n").replace(/\n/g, "%0D%0A");

dayjs.extend(require("dayjs/plugin/isoWeek"));
dayjs.extend(require("dayjs/plugin/isBetween"));
dayjs.extend(require("dayjs/plugin/isSameOrBefore"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));
dayjs.extend(require("dayjs/plugin/duration"));

var baseDate = dayjs().startOf("isoWeek"),
  cancelSync = false,
  currentStep,
  datepickers,
  downloadStats = {},
  dryrun = false,
  ffmpegIsSetup = false,
  jsonLangs = {},
  jwpubDbs = {},
  logLevel = "info",
  logOutput = {
    error: {},
    warn: {},
    info: {},
    debug: {}
  },
  meetingMedia,
  modal = new bootstrap.Modal(document.getElementById("staticBackdrop"), {
    backdrop: "static",
    keyboard: false
  }),
  now = dayjs().hour(0).minute(0).second(0).millisecond(0),
  paths = {
    app: remote.app.getPath("userData")
  },
  pendingMusicFadeOut = {},
  perfStats = {},
  prefs = {},
  tempMediaArray = [],
  totals = {},
  webdavIsAGo = false,
  stayAlive;
paths.langs = path.join(paths.app, "langs.json");
paths.lastRunVersion = path.join(paths.app, "lastRunVersion.json");
paths.prefs = path.join(paths.app, "prefs.json");

datepickers = datetime(".timePicker", {
  enableTime: true,
  noCalendar: true,
  dateFormat: "H:i",
  time_24hr: true,
  minuteIncrement: 15,
  minTime: "06:00",
  maxTime: "22:00",
  onClose: function() {
    var initiatorEl = $($(this)[0].element);
    $("#" + initiatorEl.data("target")).val(initiatorEl.val()).change();
  }
});

function goAhead() {
  if (fs.existsSync(paths.prefs)) {
    try {
      prefs = JSON.parse(fs.readFileSync(paths.prefs));
    } catch (err) {
      notifyUser("error", "errorInvalidPrefs", null, true, err, true);
    }
    prefsInitialize();
  }
  getInitialData();
  dateFormatter();
  $("#overlaySettings input:not(.timePicker), #overlaySettings select").on("change", function() {
    if ($(this).prop("tagName") == "INPUT") {
      if ($(this).prop("type") == "checkbox") {
        prefs[$(this).prop("id")] = $(this).prop("checked");
      } else if ($(this).prop("type") == "radio") {
        prefs[$(this).closest("div").prop("id")] = $(this).closest("div").find("input:checked").val();
      } else if ($(this).prop("type") == "text" || $(this).prop("type") == "password"  || $(this).prop("type") == "hidden" || $(this).prop("type") == "range") {
        prefs[$(this).prop("id")] = $(this).val();
      }
    } else if ($(this).prop("tagName") == "SELECT") {
      prefs[$(this).prop("id")] = $(this).find("option:selected").val();
    }
    if ($(this).prop("id") == "congServer" && $(this).val() == "") $("#congServerPort, #congServerUser, #congServerPass, #congServerDir, #webdavFolderList").val("").empty().change();
    if ($(this).prop("id").includes("cong")) webdavSetup();
    if ($(this).prop("id") == "localAppLang") setAppLang();
    if ($(this).prop("id") == "lang") setMediaLang();
    if ($(this).prop("id").includes("cong") || $(this).prop("name").includes("Day")) {
      rm([paths.media]);
      $(".alertIndicators i").addClass("far fa-circle").removeClass("fas fa-check-circle");
    }
    validateConfig(true);
  });
}
function additionalMedia() {
  perf("additionalMedia", "start");
  currentStep = "additionalMedia";
  return new Promise((resolve)=>{
    $("#chooseMeeting").empty();
    for (var meeting of [prefs.mwDay, prefs.weDay]) {
      let meetingDate = baseDate.add(meeting, "d").format("YYYY-MM-DD");
      $("#chooseMeeting").append("<input type='radio' class='btn-check' name='chooseMeeting' id='" + meetingDate + "' autocomplete='off'><label class='btn btn-outline-dark' for='" + meetingDate + "'" + (Object.prototype.hasOwnProperty.call(meetingMedia, meetingDate) ? "" : " style='display: none;'") + ">" + meetingDate + "</label>");
    }
    $(".relatedToUpload, .relatedToUploadType").fadeTo(fadeDelay, 0);
    $("#btnCancelUpload").fadeOut(fadeDelay);
    $("#btnDoneUpload").unbind("click").on("click", function() {
      toggleScreen("overlayUploadFile");
      $("#chooseMeeting input:checked, #chooseUploadType input:checked").prop("checked", false);
      $("#fileList, #filePicker, #jwpubPicker, .enterPrefixInput").val("").empty().change();
      $("#chooseMeeting .active, #chooseUploadType .active").removeClass("active");
      removeEventListeners();
      perf("additionalMedia", "stop");
      resolve();
    }).fadeIn(fadeDelay);
    toggleScreen("overlayUploadFile");
  });
}
function addMediaItemToPart (date, paragraph, media) {
  if (!meetingMedia[date]) meetingMedia[date] = [];
  if (!media.checksum || !meetingMedia[date].map(part => part.media).flat().map(item => item.checksum).filter(Boolean).includes(media.checksum)) {
    if (meetingMedia[date].filter(part => part.title == paragraph).length === 0) {
      meetingMedia[date].push({
        title: paragraph,
        media: []
      });
    }
    media.folder = date;
    meetingMedia[date].find(part => part.title == paragraph).media.push(media);
    meetingMedia[date] = meetingMedia[date].sort((a, b) => a.title > b.title && 1 || -1);
  }
}
function rm(toDelete) {
  if (!Array.isArray(toDelete)) toDelete = [toDelete];
  for (var fileOrDir of toDelete) {
    fs.rmSync(fileOrDir, {
      recursive: true,
      force: true
    });
  }
}
function convertPdf(mediaFile) {
  return new Promise((resolve)=>{
    var pdfjsLib = require("pdfjs-dist/build/pdf.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = require("pdfjs-dist/build/pdf.worker.entry.js");
    pdfjsLib.getDocument({
      url: mediaFile,
      verbosity: 0
    }).promise.then(async function(pdf) {
      for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        await convertPdfPage(mediaFile, pdf, pageNum);
      }
      await rm(mediaFile);
    }).catch((err) => {
      notifyUser("warn", "warnPdfConversionFailure", path.basename(mediaFile), true, err);
    }).then(() => {
      resolve();
    });
  });
}
function convertPdfPage(mediaFile, pdf, pageNum) {
  return new Promise((resolve)=>{
    pdf.getPage(pageNum).then(function(page) {
      $("body").append("<div id='pdf' style='display: none;'>");
      $("div#pdf").append("<canvas id='pdfCanvas'></canvas>");
      let scale = fullHd[1] / page.getViewport({scale: 1}).height * 2;
      var canvas = $("#pdfCanvas")[0];
      let ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      canvas.height = fullHd[1] * 2;
      canvas.width = page.getViewport({scale: scale}).width;
      page.render({
        canvasContext: ctx,
        viewport: page.getViewport({scale: scale})
      }).promise.then(function() {
        fs.writeFileSync(path.join(path.dirname(mediaFile), path.basename(mediaFile, path.extname(mediaFile)) + "-" + String(pageNum).padStart(2, "0") + ".png"), new Buffer(canvas.toDataURL().replace(/^data:image\/\w+;base64,/, ""), "base64"));
        $("div#pdf").remove();
        resolve();
      });
    });
  });
}
function convertSvg(mediaFile) {
  return new Promise((resolve)=>{
    $("body").append("<div id='svg'>");
    $("div#svg").append("<img id='svgImg'>").append("<canvas id='svgCanvas'></canvas>");
    $("img#svgImg").on("load", function() {
      let canvas = $("#svgCanvas")[0],
        image = $("img#svgImg")[0];
      image.height = fullHd[1] * 2;
      canvas.height = image.height;
      canvas.width  = image.width;
      let canvasContext = canvas.getContext("2d");
      canvasContext.fillStyle = "white";
      canvasContext.fillRect(0, 0, canvas.width, canvas.height);
      canvasContext.imageSmoothingEnabled = true;
      canvasContext.imageSmoothingQuality = "high";
      canvasContext.drawImage(image, 0, 0);
      fs.writeFileSync(path.join(path.dirname(mediaFile), path.basename(mediaFile, path.extname(mediaFile)) + ".png"), new Buffer(canvas.toDataURL().replace(/^data:image\/\w+;base64,/, ""), "base64"));
      rm(mediaFile);
      $("div#svg").remove();
      return resolve();
    });
    $("img#svgImg").on("error", function() {
      notifyUser("warn", "warnSvgConversionFailure", path.basename(mediaFile), true);
      return resolve();
    });
    $("img#svgImg").prop("src", mediaFile);
  });
}
async function convertUnusableFiles() {
  for (let pdfFile of glob.sync(path.join(paths.media, "*", "*pdf"))) {
    await convertPdf(pdfFile);
  }
  for (let svgFile of glob.sync(path.join(paths.media, "*", "*svg"))) {
    await convertSvg(svgFile);
  }
}
function createMediaNames() {
  perf("createMediaNames", "start");
  for (var h = 0; h < Object.values(meetingMedia).length; h++) { // meetings
    var meeting = Object.values(meetingMedia)[h];
    for (var i = 0; i < meeting.length; i++) { // parts
      for (var j = 0; j < meeting[i].media.length; j++) { // media
        meeting[i].media[j].safeName = (i + 1).toString().padStart(2, "0") + "-" + (j + 1).toString().padStart(2, "0");
        if (meeting[i].media[j].filesize) {
          meeting[i].media[j].safeName = sanitizeFilename(meeting[i].media[j].safeName + " - " + ((meeting[i].media[j].queryInfo.TargetParagraphNumberLabel ? meeting[i].media[j].queryInfo.TargetParagraphNumberLabel + "- " : "")) + meeting[i].media[j].title + path.extname((meeting[i].media[j].url ? meeting[i].media[j].url : meeting[i].media[j].filepath)));
        } else {
          continue;
        }
      }
    }
  }
  log.debug(Object.entries(meetingMedia).map(meeting => { meeting[1] = meeting[1].filter(mediaItem => mediaItem.media.length > 0).map(item => item.media).flat(); return meeting; }));
  perf("createMediaNames", "stop");
}
function createVideoSync(mediaFile){
  let outputFilePath = path.format({ ...path.parse(mediaFile), base: undefined, ext: ".mp4" });
  return new Promise((resolve)=>{
    try {
      if (path.extname(mediaFile).includes("mp3")) {
        ffmpegSetup().then(function () {
          ffmpeg(mediaFile).on("end", function() {
            rm(mediaFile);
            return resolve();
          }).on("error", function(err) {
            notifyUser("warn", "warnMp4ConversionFailure", path.basename(mediaFile), true, err, true);
            return resolve();
          }).noVideo().save(path.join(outputFilePath));
        });
      } else {
        let convertedImageDimensions = [],
          imageDimesions = sizeOf(mediaFile);
        if (imageDimesions.orientation && imageDimesions.orientation >= 5) [imageDimesions.width, imageDimesions.height] = [imageDimesions.height, imageDimesions.width];
        convertedImageDimensions = aspect.resize(imageDimesions.width, imageDimesions.height, (fullHd[1] / fullHd[0] > imageDimesions.height / imageDimesions.width ? (imageDimesions.width > fullHd[0] ? fullHd[0] : imageDimesions.width) : null), (fullHd[1] / fullHd[0] > imageDimesions.height / imageDimesions.width ? null : (imageDimesions.height > fullHd[1] ? fullHd[1] : imageDimesions.height)));
        $("body").append("<div id='convert' style='display: none;'>");
        $("div#convert").append("<img id='imgToConvert'>").append("<canvas id='imgCanvas'></canvas>");
        hme.createH264MP4Encoder().then(function (encoder) {
          $("img#imgToConvert").on("load", function() {
            var canvas = $("#imgCanvas")[0],
              image = $("img#imgToConvert")[0];
            encoder.quantizationParameter = 10;
            image.width = convertedImageDimensions[0];
            image.height = convertedImageDimensions[1];
            encoder.width = canvas.width = (image.width % 2 ? image.width - 1 : image.width);
            encoder.height = canvas.height = (image.height % 2 ? image.height - 1 : image.height);
            encoder.initialize();
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            encoder.addFrameRgba(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data);
            encoder.finalize();
            fs.writeFileSync(outputFilePath, encoder.FS.readFile(encoder.outputFilename));
            encoder.delete();
            $("div#convert").remove();
            rm(mediaFile);
            return resolve();
          });
          $("img#imgToConvert").on("error", function(err) {
            notifyUser("warn", "warnMp4ConversionFailure", path.basename(mediaFile), true, err, true);
            $("div#convert").remove();
            return resolve();
          });
          $("img#imgToConvert").prop("src", mediaFile);
        });
      }
    } catch (err) {
      notifyUser("warn", "warnMp4ConversionFailure", path.basename(mediaFile), true, err, true);
      return resolve();
    }
  });
}
function dateFormatter() {
  let locale = prefs.localAppLang ? prefs.localAppLang : "en";
  try {
    if (locale !== "en") require("dayjs/locale/" + locale);
  } catch(err) {
    log.warn("%c[locale] Date locale " + locale + " not found, falling back to 'en'");
  }
  $(".today").removeClass("today");
  for (var d = 0; d < 7; d++) {
    $("#day" + d + " .dayLongDate .dayOfWeek").text(baseDate.clone().add(d, "days").locale(locale).format("ddd"));
    $("#day" + d + " .dayLongDate .dayOfWeekLong").text(baseDate.clone().add(d, "days").locale(locale).format("dddd"));
    $("#day" + d + " .dayLongDate .dateOfMonth .date").text(baseDate.clone().add(d, "days").locale(locale).format("DD"));
    $("#day" + d + " .dayLongDate .dateOfMonth .month").text(baseDate.clone().add(d, "days").locale(locale).format("MMM"));
    $("#mwDay label:eq(" + d + ")").text(baseDate.clone().add(d, "days").locale(locale).format("dd"));
    $("#weDay label:eq(" + d + ")").text(baseDate.clone().add(d, "days").locale(locale).format("dd"));
    let meetingInPast = baseDate.clone().add(d, "days").isBefore(now);
    $("#day" + d).toggleClass("alert-secondary", meetingInPast).toggleClass("alert-primary", !meetingInPast).find("i").toggle(!meetingInPast);
    if (baseDate.clone().add(d, "days").isSame(now)) $("#day" + d).addClass("today");
  }
}
const delay = s => new Promise(res => {
  setTimeout(res, s * 1000);
  let secsRemaining = s;
  $("button .action-countdown").html(secsRemaining);
  const timeinterval = setInterval(function() {
    secsRemaining--;
    if (secsRemaining < 1) {
      secsRemaining = "";
      $("button .action-countdown").html();
      clearInterval(timeinterval);
    }
    $("button .action-countdown").html(secsRemaining);
  }, 1000);
  $("#bottomIcon button").on("click", function() {
    window[$(this).attr("class").split(" ").filter(el => el.includes("btn-action-")).join(" ").split("-").splice(2).join("-").toLowerCase().replace(/([-_][a-z])/g, group => group.toUpperCase().replace("-", "").replace("_", ""))] = true;
    clearInterval(timeinterval);
    overlay(false);
  });
});
function disableGlobalPref([pref, value]) {
  let row = $("#" + pref).closest("div.row");
  if (row.find(".settingLocked").length === 0) row.find("label").first().prepend($("<span class='badge bg-warning me-1 rounded-pill settingLocked text-black i18n-title' data-bs-toggle='tooltip'><i class='fa-lock fas'></i></span>"));
  row.addClass("text-muted disabled").attr("title", i18n.__("settingLocked")).tooltip().find("#" + pref + ", #" + pref + " input, input[data-target=" + pref + "]").addClass("forcedPref").prop("disabled", true);
  log.info("%c[enforcedPrefs] [" + pref + "] " + value, "background-color: #FCE4EC; color: #AD1457;");
}
function displayMusicRemaining() {
  let timeRemaining;
  if (prefs.enableMusicFadeOut && pendingMusicFadeOut.endTime >0) {
    let rightNow = dayjs();
    timeRemaining = (dayjs(pendingMusicFadeOut.endTime).isAfter(rightNow) ? dayjs(pendingMusicFadeOut.endTime).diff(rightNow) : 0);
  } else {
    timeRemaining = (isNaN($("#meetingMusic")[0].duration) ? 0 : ($("#meetingMusic")[0].duration - $("#meetingMusic")[0].currentTime) * 1000);
  }
  $("#musicRemaining").text(dayjs.duration(timeRemaining, "ms").format((timeRemaining >= 3600000 ? "HH:" : "") + "mm:ss"));
}
async function downloadIfRequired(file) {
  file.downloadRequired = true;
  file.localDir = file.pub ? path.join(paths.pubs, file.pub, file.issue) : path.join(paths.media, file.folder);
  file.localFile = path.join(file.localDir, file.pub ? path.basename(file.url) : file.safeName);
  if (fs.existsSync(file.localFile)) file.downloadRequired = file.filesize !== fs.statSync(file.localFile).size;
  if (file.downloadRequired) {
    mkdirSync(file.localDir);
    fs.writeFileSync(file.localFile, new Buffer((await request(file.url, {isFile: true})).data));
    downloadStat("jworg", "live", file);
  } else {
    downloadStat("jworg", "cache", file);
  }
  if (path.extname(file.localFile) == ".jwpub") await new zipper((await new zipper(file.localFile).readFile("contents"))).extractAllTo(file.localDir);
}
function downloadStat(origin, source, file) {
  if (!downloadStats[origin]) downloadStats[origin] = {};
  if (!downloadStats[origin][source]) downloadStats[origin][source] = [];
  downloadStats[origin][source].push(file);
}
function enablePreviouslyForcedPrefs() {
  $("div.row.text-muted.disabled").removeClass("text-muted disabled").attr("title", "").tooltip("dispose").find(".forcedPref").prop("disabled", false).removeClass("forcedPref");
  $("div.row .settingLocked").remove();
}
async function enforcePrefs() {
  paths.forcedPrefs = path.posix.join(prefs.congServerDir, "forcedPrefs.json");
  let forcedPrefs = await getForcedPrefs();
  if (Object.keys(forcedPrefs).length > 0) {
    let previousPrefs = v8.deserialize(v8.serialize(prefs));
    Object.assign(prefs, forcedPrefs);
    if (JSON.stringify(previousPrefs) !== JSON.stringify(prefs)) {
      setMediaLang();
      validateConfig(true);
      prefsInitialize();
    }
    for (var pref of Object.entries(forcedPrefs)) {
      disableGlobalPref(pref);
    }
  } else {
    enablePreviouslyForcedPrefs(true);
  }
}
async function executeDryrun(persistantOverlay) {
  await overlay(true, "cloud fa-beat");
  await startMediaSync(true);
  if (!persistantOverlay) await overlay(false);
}
async function executeStatement(db, statement) {
  var vals = await db.exec(statement)[0],
    valObj = [];
  if (vals) {
    for (var v = 0; v < vals.values.length; v++) {
      valObj[v] = {};
      for (var c = 0; c < vals.columns.length; c++) {
        valObj[v][vals.columns[c]] = vals.values[v][c];
      }
    }
  }
  log.debug({statement: statement, valObj: valObj});
  return valObj;
}
async function ffmpegSetup() {
  if (!ffmpegIsSetup) {
    var osType = os.type();
    var targetOs;
    if (osType == "Windows_NT") {
      targetOs = "win-64";
    } else if (osType == "Darwin") {
      targetOs = "osx-64";
    } else {
      targetOs = "linux-64";
    }
    var ffmpegVersion = (await request("https://api.github.com/repos/vot/ffbinaries-prebuilt/releases/latest")).data.assets.filter(a => a.name.includes(targetOs) && a.name.includes("ffmpeg"))[0];
    var ffmpegZipPath = path.join(paths.app, "ffmpeg", "zip", ffmpegVersion.name);
    if (!fs.existsSync(ffmpegZipPath) || fs.statSync(ffmpegZipPath).size !== ffmpegVersion.size) {
      await rm([path.join(paths.app, "ffmpeg", "zip")]);
      mkdirSync(path.join(paths.app, "ffmpeg", "zip"));
      fs.writeFileSync(ffmpegZipPath, new Buffer((await request(ffmpegVersion.browser_download_url, {isFile: true})).data));
    }
    var zip = new zipper(ffmpegZipPath);
    var zipEntry = zip.getEntries().filter((x) => !x.entryName.includes("MACOSX"))[0];
    var ffmpegPath = path.join(path.join(paths.app, "ffmpeg", zipEntry.entryName));
    if (!fs.existsSync(ffmpegPath) || fs.statSync(ffmpegPath).size !== zipEntry.header.size) {
      zip.extractEntryTo(zipEntry.entryName, path.join(paths.app, "ffmpeg"), true, true);
    }
    try {
      fs.accessSync(ffmpegPath, fs.constants.X_OK);
    } catch (err) {
      fs.chmodSync(ffmpegPath, "777");
    }
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpegIsSetup = true;
  }
}
async function getCongMedia() {
  perf("getCongMedia", "start");
  updateTile("specificCong", "warning", "fas fa-circle-notch fa-spin");
  updateStatus("cloud");
  try {
    for (let congSpecificFolder of (await webdavLs(path.posix.join(prefs.congServerDir, "Media")))) {
      let isMeetingDate = dayjs(congSpecificFolder.basename, "YYYY-MM-DD").isValid() && dayjs(congSpecificFolder.basename, "YYYY-MM-DD").isBetween(baseDate, baseDate.clone().add(6, "days"), null, "[]") && now.isSameOrBefore(dayjs(congSpecificFolder.basename, "YYYY-MM-DD"));
      let isRecurring = congSpecificFolder.basename == "Recurring";
      if (isMeetingDate || isRecurring) {
        for (let remoteFile of (await webdavLs(path.posix.join(prefs.congServerDir, "Media", congSpecificFolder.basename)))) {
          let congSpecificFile = {
            "title": "Congregation-specific",
            media: [{
              safeName: remoteFile.basename,
              congSpecific: true,
              filesize: remoteFile.size,
              folder: congSpecificFolder.basename,
              url: remoteFile.filename
            }]
          };
          if (!meetingMedia[congSpecificFolder.basename]) meetingMedia[congSpecificFolder.basename] = [];
          meetingMedia[congSpecificFolder.basename].push(congSpecificFile);
          if (isRecurring) {
            for (var meeting of Object.keys(meetingMedia)) {
              if (dayjs(meeting, "YYYY-MM-DD").isValid()) {
                var repeatFile = v8.deserialize(v8.serialize(congSpecificFile));
                repeatFile.media[0].recurring = true;
                repeatFile.media[0].folder = meeting;
                meetingMedia[meeting].push(repeatFile);
              }
            }
          }
        }
      }
    }
    for (var hiddenFilesFolder of (await webdavLs(path.posix.join(prefs.congServerDir, "Hidden"))).filter(hiddenFilesFolder => dayjs(hiddenFilesFolder.basename, "YYYY-MM-DD").isValid() && dayjs(hiddenFilesFolder.basename, "YYYY-MM-DD").isBetween(baseDate, baseDate.clone().add(6, "days"), null, "[]") && now.isSameOrBefore(dayjs(hiddenFilesFolder.basename, "YYYY-MM-DD"))).sort((a, b) => (a.basename > b.basename) ? 1 : -1)) {
      for (var hiddenFile of await webdavLs(path.posix.join(prefs.congServerDir, "Hidden", hiddenFilesFolder.basename))) {
        var hiddenFileLogString = "background-color: #d6d8d9; color: #1b1e21;";
        if (meetingMedia[hiddenFilesFolder.basename]) {
          meetingMedia[hiddenFilesFolder.basename].filter(part => part.media.filter(mediaItem => mediaItem.safeName == hiddenFile.basename).map(function (mediaItem) {
            mediaItem.hidden = true;
            hiddenFileLogString = "background-color: #fff3cd; color: #856404;";
          }));
        }
        log.info("%c[hiddenMedia] [" + hiddenFilesFolder.basename + "] " + hiddenFile.basename, hiddenFileLogString);
      }
    }
  } catch (err) {
    notifyUser("error", "errorGetCongMedia", null, true, err, true);
    updateTile("specificCong", "danger", "fas fa-times-circle");
  }
  perf("getCongMedia", "stop");
}
async function getDbFromJwpub(pub, issue, localpath) {
  try {
    var SQL = await sqljs();
    if (localpath) {
      var jwpubContents = await new zipper(localpath).readFile("contents");
      var tempDb = new SQL.Database(await new zipper(jwpubContents).readFile((await new zipper(jwpubContents).getEntries()).filter(entry => path.extname(entry.name) == ".db")[0].entryName));
      var jwpubInfo = (await executeStatement(tempDb, "SELECT UniqueEnglishSymbol, IssueTagNumber FROM Publication"))[0];
      pub = jwpubInfo.UniqueEnglishSymbol.replace(/[0-9]/g, "");
      issue = jwpubInfo.IssueTagNumber;
      if (!jwpubDbs[pub]) jwpubDbs[pub] = {};
      jwpubDbs[pub][issue] = tempDb;
    } else {
      if (!jwpubDbs[pub]) jwpubDbs[pub] = {};
      if (!jwpubDbs[pub][issue]) {
        var jwpub = (await getMediaLinks(pub, null, issue, "JWPUB"))[0];
        jwpub.pub = pub;
        jwpub.issue = issue;
        await downloadIfRequired(jwpub);
        jwpubDbs[pub][issue] = new SQL.Database(fs.readFileSync(glob.sync(path.join(paths.pubs, jwpub.pub, jwpub.issue, "*.db"))[0]));
      }
    }
    return jwpubDbs[pub][issue];
  } catch (err) {
    notifyUser("warn", "errorJwpubDbFetch", pub + " - " + issue, false, err, true);
  }
}
async function getDocumentExtract(db, docId) {
  var extractMultimediaItems = [];
  for (var extractItem of (await executeStatement(db, "SELECT DocumentExtract.BeginParagraphOrdinal,DocumentExtract.EndParagraphOrdinal,DocumentExtract.DocumentId,Extract.RefMepsDocumentId,Extract.RefPublicationId,Extract.RefMepsDocumentId,UniqueEnglishSymbol,IssueTagNumber,Extract.RefBeginParagraphOrdinal,Extract.RefEndParagraphOrdinal FROM DocumentExtract INNER JOIN Extract ON DocumentExtract.ExtractId = Extract.ExtractId INNER JOIN RefPublication ON Extract.RefPublicationId = RefPublication.RefPublicationId INNER JOIN Document ON DocumentExtract.DocumentId = Document.DocumentId WHERE DocumentExtract.DocumentId = " + docId + " AND NOT UniqueEnglishSymbol = 'sjj' AND NOT UniqueEnglishSymbol = 'mwbr' " + (prefs.excludeTh ? "AND NOT UniqueEnglishSymbol = 'th' " : "") + "ORDER BY DocumentExtract.BeginParagraphOrdinal"))) {
    var extractDb = await getDbFromJwpub(extractItem.UniqueEnglishSymbol.replace(/[0-9]/g, ""), extractItem.IssueTagNumber);
    if (extractDb) {
      extractMultimediaItems = extractMultimediaItems.concat((await getDocumentMultimedia(extractDb, null, extractItem.RefMepsDocumentId)).filter(extractMediaFile => {
        if (extractMediaFile.queryInfo.tableQuestionIsUsed && !extractMediaFile.queryInfo.TargetParagraphNumberLabel) extractMediaFile.BeginParagraphOrdinal = extractMediaFile.queryInfo.NextParagraphOrdinal;
        if (extractMediaFile.BeginParagraphOrdinal && extractItem.RefBeginParagraphOrdinal && extractItem.RefEndParagraphOrdinal) {
          return extractItem.RefBeginParagraphOrdinal <= extractMediaFile.BeginParagraphOrdinal && extractMediaFile.BeginParagraphOrdinal <= extractItem.RefEndParagraphOrdinal;
        } else {
          return true;
        }
      }).map(extractMediaFile => {
        extractMediaFile.BeginParagraphOrdinal = extractItem.BeginParagraphOrdinal;
        return extractMediaFile;
      }));
    }
  }
  return extractMultimediaItems;
}
async function getDocumentMultimedia(db, destDocId, destMepsId, memOnly) {
  let tableMultimedia = ((await executeStatement(db, "SELECT * FROM sqlite_master WHERE type='table' AND name='DocumentMultimedia'")).length === 0 ? "Multimedia" : "DocumentMultimedia");
  let keySymbol = (await executeStatement(db, "SELECT UniqueEnglishSymbol FROM Publication"))[0].UniqueEnglishSymbol.replace(/[0-9]*/g, "");
  let issueTagNumber = (await executeStatement(db, "SELECT IssueTagNumber FROM Publication"))[0].IssueTagNumber;
  let targetParagraphNumberLabelExists = (await executeStatement(db, "PRAGMA table_info('Question')")).map(item => item.name).includes("TargetParagraphNumberLabel");
  let suppressZoomExists = (await executeStatement(db, "PRAGMA table_info('Multimedia')")).map(item => item.name).includes("SuppressZoom");
  let multimediaItems = [];
  if (!(keySymbol == "lffi" && prefs.excludeLffi && prefs.excludeLffiImages)) for (var multimediaItem of (await executeStatement(db, "SELECT " + tableMultimedia + ".DocumentId, " + tableMultimedia + ".MultimediaId, " + (tableMultimedia == "DocumentMultimedia" ? tableMultimedia + ".BeginParagraphOrdinal, " + tableMultimedia + ".EndParagraphOrdinal, Multimedia.KeySymbol, Multimedia.MultimediaId," + (suppressZoomExists ? " Multimedia.SuppressZoom," : "") + " Multimedia.MepsDocumentId AS MultiMeps, Document.MepsDocumentId, Multimedia.Track, Multimedia.IssueTagNumber, " : "Multimedia.CategoryType, ") + (targetParagraphNumberLabelExists && tableMultimedia == "DocumentMultimedia" ? "Question.TargetParagraphNumberLabel, " : "") + "Multimedia.MimeType, Multimedia.DataType, Multimedia.MajorType, Multimedia.FilePath, Multimedia.Label, Multimedia.Caption, Multimedia.CategoryType FROM " + tableMultimedia + (tableMultimedia == "DocumentMultimedia" ? " INNER JOIN Multimedia ON Multimedia.MultimediaId = " + tableMultimedia + ".MultimediaId" : "") + " INNER JOIN Document ON " + tableMultimedia + ".DocumentId = Document.DocumentId " + (targetParagraphNumberLabelExists && tableMultimedia == "DocumentMultimedia" ? "LEFT JOIN Question ON Question.DocumentId = " + tableMultimedia + ".DocumentId AND Question.TargetParagraphOrdinal = " + tableMultimedia + ".BeginParagraphOrdinal " : "") + "WHERE " + (destDocId || destDocId === 0 ? tableMultimedia + ".DocumentId = " + destDocId : "Document.MepsDocumentId = " + destMepsId) + " AND (" + (keySymbol !== "lffi" || !prefs.excludeLffi ? "(Multimedia.MimeType LIKE '%video%' OR Multimedia.MimeType LIKE '%audio%')" : "") + (keySymbol !== "lffi" || (!prefs.excludeLffi && !prefs.excludeLffiImages) ? " OR " : "") + (keySymbol !== "lffi" || !prefs.excludeLffiImages ? "(Multimedia.MimeType LIKE '%image%' AND Multimedia.CategoryType <> 6 AND Multimedia.CategoryType <> 9 AND Multimedia.CategoryType <> 10 AND Multimedia.CategoryType <> 25)" : "") + ")" + (suppressZoomExists ? " AND Multimedia.SuppressZoom <> 1" : "") + (tableMultimedia == "DocumentMultimedia" ? " GROUP BY " + tableMultimedia + ".MultimediaId ORDER BY BeginParagraphOrdinal" : "")))) {
    if (targetParagraphNumberLabelExists) {
      let paragraphNumber = await executeStatement(db, "SELECT TargetParagraphNumberLabel From Question WHERE DocumentId = " + multimediaItem.DocumentId + " AND TargetParagraphOrdinal = " + multimediaItem.BeginParagraphOrdinal);
      if (paragraphNumber.length === 1) Object.assign(multimediaItem, paragraphNumber[0]);
      if ((await executeStatement(db, "SELECT COUNT(*) as Count FROM Question"))[0].Count > 0) {
        multimediaItem.tableQuestionIsUsed = true;
        let nextParagraphQuery = await executeStatement(db, "SELECT TargetParagraphNumberLabel, TargetParagraphOrdinal From Question WHERE DocumentId = " + multimediaItem.DocumentId + " AND TargetParagraphOrdinal > " + multimediaItem.BeginParagraphOrdinal + " LIMIT 1");
        if (nextParagraphQuery.length > 0) multimediaItem.NextParagraphOrdinal = nextParagraphQuery[0].TargetParagraphOrdinal;
      }
    }
    try {
      if ((multimediaItem.MimeType.includes("audio") || multimediaItem.MimeType.includes("video"))) {
        var json = {
          queryInfo: multimediaItem,
          BeginParagraphOrdinal: multimediaItem.BeginParagraphOrdinal
        };
        Object.assign(json, (await getMediaLinks(multimediaItem.KeySymbol, multimediaItem.Track, multimediaItem.IssueTagNumber, null, multimediaItem.MultiMeps))[0]);
        multimediaItems.push(json);
      } else {
        if (multimediaItem.KeySymbol == null) {
          multimediaItem.KeySymbol = keySymbol;
          multimediaItem.IssueTagNumber = issueTagNumber;
          if (!memOnly) multimediaItem.LocalPath = path.join(paths.pubs, multimediaItem.KeySymbol, multimediaItem.IssueTagNumber, multimediaItem.FilePath);
        }
        multimediaItem.FileName = sanitizeFilename((multimediaItem.Caption.length > multimediaItem.Label.length ? multimediaItem.Caption : multimediaItem.Label), true);
        var picture = {
          BeginParagraphOrdinal: multimediaItem.BeginParagraphOrdinal,
          title: multimediaItem.FileName,
          queryInfo: multimediaItem
        };
        if (!memOnly) {
          picture.filepath = multimediaItem.LocalPath;
          picture.filesize = fs.statSync(multimediaItem.LocalPath).size;
        }
        multimediaItems.push(picture);
      }
    } catch (err) {
      notifyUser("warn", "errorJwpubMediaExtract", keySymbol + " - " + issueTagNumber, false, err, true);
    }
  }
  return multimediaItems;
}
async function getForcedPrefs() {
  let forcedPrefs = {};
  if (await webdavExists(paths.forcedPrefs)) {
    try {
      forcedPrefs = (await request("https://" + prefs.congServer + ":" + prefs.congServerPort + paths.forcedPrefs, {
        webdav: true,
        noCache: true
      })).data;
    } catch(err) {
      notifyUser("error", "errorForcedSettingsEnforce", null, true, err);
    }
  }
  return forcedPrefs;
}
async function getInitialData() {
  await getJwOrgLanguages();
  await getLocaleLanguages();
  await setAppLang();
  await updateCleanup();
  await setMediaLang();
  await webdavSetup();
  let configIsValid = validateConfig();
  $("#version").html("JWMMF " + escape(currentAppVersion));
  $("#day" + prefs.mwDay + ", #day" + prefs.weDay).addClass("meeting");
  if (os.platform() == "linux") $(".notLinux").prop("disabled", true);
  $("#baseDate button, #baseDate .dropdown-item:eq(0)").text(baseDate.format("YYYY-MM-DD") + " - " + baseDate.clone().add(6, "days").format("YYYY-MM-DD")).val(baseDate.format("YYYY-MM-DD"));
  $("#baseDate .dropdown-item:eq(0)").addClass("active");
  for (var a = 1; a <= 4; a++) {
    $("#baseDate .dropdown-menu").append("<button class='dropdown-item' value='" + baseDate.clone().add(a, "week").format("YYYY-MM-DD") + "'>" + baseDate.clone().add(a, "week").format("YYYY-MM-DD") + " - " + baseDate.clone().add(a, "week").add(6, "days").format("YYYY-MM-DD") + "</button>");
  }
  if (prefs.autoStartSync && configIsValid) {
    await overlay(true, "flag-checkered fa-beat", "pause", "cancel-sync");
    await delay(5);
    if (!cancelSync) $("#mediaSync").click();
  }
  overlay(false, (prefs.autoStartSync && configIsValid ? "flag-checkered" : null));
}
async function getJwOrgLanguages(forceRefresh) {
  if ((!fs.existsSync(paths.langs)) || (!prefs.langUpdatedLast) || dayjs(prefs.langUpdatedLast).isBefore(now.subtract(3, "months")) || forceRefresh) {
    let cleanedJwLangs = (await request("https://www.jw.org/en/languages/")).data.languages.filter(lang => lang.hasWebContent).map(lang => ({
      name: lang.name,
      langcode: lang.langcode,
      symbol: lang.symbol,
      vernacularName: lang.vernacularName
    }));
    fs.writeFileSync(paths.langs, JSON.stringify(cleanedJwLangs, null, 2));
    prefs.langUpdatedLast = dayjs();
    validateConfig(true);
    jsonLangs = cleanedJwLangs;
  } else {
    jsonLangs = JSON.parse(fs.readFileSync(paths.langs));
  }
  for (var lang of jsonLangs) {
    $("#lang").append($("<option>", {
      value: lang.langcode,
      text: lang.vernacularName + " (" + lang.name + ")"
    }));
  }
  $("#lang").val(prefs.lang).select2();
}
function getLocaleLanguages() {
  for (var localeLang of fs.readdirSync(path.join(__dirname, "locales")).map(file => file.replace(".json", ""))) {
    let localeLangMatches = jsonLangs.filter(item => item.symbol === localeLang);
    $("#localAppLang").append($("<option>", {
      value: localeLang,
      text: (localeLangMatches.length === 1 ? localeLangMatches[0].vernacularName + " (" + localeLangMatches[0].name + ")" : localeLang)
    }));
  }
  $("#localAppLang").val(prefs.localAppLang);
}
async function getMediaLinks(pub, track, issue, format, docId) {
  let mediaFiles = [];
  if (prefs.lang && prefs.maxRes) {
    try {
      if (pub === "w" && parseInt(issue) >= 20080101 && issue.slice(-2) == "01") pub = "wp";
      let requestUrl = "https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json" + (docId ? "&docid=" + docId : "&pub=" + pub + (track ? "&track=" + track : "") + (issue ? "&issue=" + issue : "")) + (format ? "&fileformat=" + format : "") + "&langwritten=" + prefs.lang;
      let result = (await request(requestUrl)).data;
      log.debug(pub, track, issue, format, docId, requestUrl);
      if (result && result.length > 0 && result[0].status && result[0].status == 404 && pub && track) {
        requestUrl = "https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json" + "&pub=" + pub + "m" + "&track=" + track + (issue ? "&issue=" + issue : "") + (format ? "&fileformat=" + format : "") + "&langwritten=" + prefs.lang;
        result = (await request(requestUrl)).data;
        log.debug(pub + "m", track, issue, format, docId, requestUrl);
      }
      if (result && result.files) {
        let mediaFileCategories = Object.values(result.files)[0];
        mediaFiles = mediaFileCategories[("MP4" in mediaFileCategories ? "MP4" : Object.keys(mediaFileCategories)[0])].filter(({label}) => label.replace(/\D/g, "") <= prefs.maxRes.replace(/\D/g, ""));
        let map = new Map(mediaFiles.map(item => [item.title, item]));
        for (let item of mediaFiles) {
          let {label, subtitled} = map.get(item.title);
          if ((item.label.replace(/\D/g, "") - label.replace(/\D/g, "") || subtitled - item.subtitled) > 0) map.set(item.title, item);
        }
        mediaFiles = Array.from(map.values(), ({title, file: {url}, file: {checksum}, filesize, duration, trackImage}) => ({title, url, checksum, filesize, duration, trackImage})).map(item => {
          item.trackImage = item.trackImage.url;
          return item;
        });
        for (var item of mediaFiles) {
          if (item.duration >0 && !item.trackImage) {
            item.trackImage = await getMediaThumbnail(pub, track, issue, format, docId);
          }
        }
      }
    } catch(err) {
      notifyUser("warn", "infoPubIgnored", pub + " - " + track + " - " + issue + " - " + format, false, err);
    }
  }
  log.debug(mediaFiles);
  return mediaFiles;
}
async function getMediaThumbnail(pub, track, issue, format, docId) {
  let thumbnail = "";
  if (issue) issue = issue.toString().replace(/(\d{6})00$/gm, "$1");
  let result = (await request("https://b.jw-cdn.org/apis/mediator/v1/media-items/" + prefs.lang + "/" + (docId ? "docid-" + docId + "_1": "pub-" + [pub, issue, track].filter(Boolean).join("_")) + "_VIDEO")).data;
  if (result && result.media && result.media.length > 0 && result.media[0].images.wss.sm) thumbnail = result.media[0].images.wss.sm;
  return thumbnail;
}
async function getMwMediaFromDb() {
  var mwDate = baseDate.clone().add(prefs.mwDay, "days").format("YYYY-MM-DD");
  if (now.isSameOrBefore(dayjs(mwDate))) {
    updateTile("day" + prefs.mwDay, "warning", "fas fa-circle-notch fa-spin");
    try {
      var issue = baseDate.format("YYYYMM") + "00";
      if (parseInt(baseDate.format("M")) % 2 === 0) issue = baseDate.clone().subtract(1, "months").format("YYYYMM") + "00";
      var db = await getDbFromJwpub("mwb", issue);
      var docId = (await executeStatement(db, "SELECT DocumentId FROM DatedText WHERE FirstDateOffset = " + baseDate.format("YYYYMMDD") + ""))[0].DocumentId;
      (await getDocumentMultimedia(db, docId)).map(video => {
        addMediaItemToPart(mwDate, video.BeginParagraphOrdinal, video);
      });
      (await getDocumentExtract(db, docId)).map(extract => {
        addMediaItemToPart(mwDate, extract.BeginParagraphOrdinal, extract);
      });
      for (var internalRef of (await executeStatement(db, "SELECT DocumentInternalLink.DocumentId AS SourceDocumentId, DocumentInternalLink.BeginParagraphOrdinal, Document.DocumentId FROM DocumentInternalLink INNER JOIN InternalLink ON DocumentInternalLink.InternalLinkId = InternalLink.InternalLinkId INNER JOIN Document ON InternalLink.MepsDocumentId = Document.MepsDocumentId WHERE DocumentInternalLink.DocumentId = " + docId + " AND Document.Class <> 94"))) {
        (await getDocumentMultimedia(db, internalRef.DocumentId)).map(internalRefMediaFile => {
          addMediaItemToPart(mwDate, internalRef.BeginParagraphOrdinal, internalRefMediaFile);
        });
      }
      updateTile("day" + prefs.mwDay, "success", "fas fa-check-circle");
    } catch(err) {
      notifyUser("error", "errorGetMwMedia", null, true, err, true);
      updateTile("day" + prefs.mwDay, "danger", "fas fa-times-circle");
    }
  }
}
function getPrefix() {
  if (!$("#chooseMeeting input").prop("disabled")) for (var a0 = 0; a0 < 6; a0++) {
    let curValuePresent = $("#enterPrefix-" + a0).val().length > 0;
    if (!curValuePresent) $(Array(6 - 1 - a0).fill(a0).map((x, y) => "#enterPrefix-" + (x + 1 + y)).join(", ")).val("");
    $("#enterPrefix-" + (a0 + 1)).prop("disabled", !curValuePresent).stop().fadeTo(fadeDelay, curValuePresent);
  }
  let prefix = $(".enterPrefixInput").map(function() {
    return $(this).val();
  }).toArray().join("").trim();
  if ($("#enterPrefix-0").val().length > 0) $("#enterPrefix-" + prefix.length).focus();
  if (prefix.length % 2) prefix = prefix + 0;
  if (prefix.length > 0) prefix = prefix.match(/.{1,2}/g).join("-");
  return prefix;
}
function setAppLang() {
  i18n.setLocale(prefs.localAppLang ? prefs.localAppLang : "en");
  $("[data-i18n-string]").each(function() {
    $(this).html(i18n.__($(this).data("i18n-string")));
  });
  $(".i18n-title").attr("title", i18n.__("settingLocked")).tooltip("dispose").tooltip();
  dateFormatter();
}
async function getWeMediaFromDb() {
  var weDate = baseDate.clone().add(prefs.weDay, "days").format("YYYY-MM-DD");
  if (now.isSameOrBefore(dayjs(weDate))) {
    updateTile("day" + prefs.weDay, "warning", "fas fa-circle-notch fa-spin");
    try {
      var issue = baseDate.clone().subtract(8, "weeks").format("YYYYMM") + "00";
      var db = await getDbFromJwpub("w", issue);
      var weekNumber = (await executeStatement(db, "SELECT FirstDateOffset FROM DatedText")).findIndex(weekItem => dayjs(weekItem.FirstDateOffset.toString(), "YYYYMMDD").isBetween(baseDate, baseDate.clone().add(6, "days"), null, "[]"));
      if (weekNumber < 0) {
        issue = baseDate.clone().subtract(9, "weeks").format("YYYYMM") + "00";
        db = await getDbFromJwpub("w", issue);
        weekNumber = (await executeStatement(db, "SELECT FirstDateOffset FROM DatedText")).findIndex(weekItem => dayjs(weekItem.FirstDateOffset.toString(), "YYYYMMDD").isBetween(baseDate, baseDate.clone().add(6, "days"), null, "[]"));
      }
      if (weekNumber < 0) throw("No WE meeting date found!");
      var docId = (await executeStatement(db, "SELECT Document.DocumentId FROM Document WHERE Document.Class=40 LIMIT 1 OFFSET " + weekNumber))[0].DocumentId;
      for (var picture of (await executeStatement(db, "SELECT DocumentMultimedia.MultimediaId,Document.DocumentId, Multimedia.CategoryType,Multimedia.KeySymbol,Multimedia.Track,Multimedia.IssueTagNumber,Multimedia.MimeType, DocumentMultimedia.BeginParagraphOrdinal,Multimedia.FilePath,Label,Caption, Question.TargetParagraphNumberLabel FROM DocumentMultimedia INNER JOIN Document ON Document.DocumentId = DocumentMultimedia.DocumentId INNER JOIN Multimedia ON DocumentMultimedia.MultimediaId = Multimedia.MultimediaId LEFT JOIN Question ON Question.DocumentId = DocumentMultimedia.DocumentId AND Question.TargetParagraphOrdinal = DocumentMultimedia.BeginParagraphOrdinal WHERE Document.DocumentId = " + docId + " AND Multimedia.CategoryType <> 9"))) {
        var LocalPath = path.join(paths.pubs, "w", issue, picture.FilePath);
        var FileName = sanitizeFilename((picture.Caption.length > picture.Label.length ? picture.Caption : picture.Label), true);
        var pictureObj = {
          title: FileName,
          filepath: LocalPath,
          filesize: fs.statSync(LocalPath).size,
          queryInfo: picture
        };
        addMediaItemToPart(weDate, picture.BeginParagraphOrdinal, pictureObj);
      }
      var qrySongs = await executeStatement(db, "SELECT * FROM Multimedia INNER JOIN DocumentMultimedia ON Multimedia.MultimediaId = DocumentMultimedia.MultimediaId WHERE DataType = 2 ORDER BY BeginParagraphOrdinal LIMIT 2 OFFSET " + weekNumber * 2);
      for (var song = 0; song < qrySongs.length; song++) {
        let songJson = await getMediaLinks(qrySongs[song].KeySymbol, qrySongs[song].Track);
        if (songJson.length > 0) {
          songJson[0].queryInfo = qrySongs[song];
          addMediaItemToPart(weDate, song * 1000, songJson[0]);
        } else {
          notifyUser("error", "errorGetWeMedia", null, true, songJson, true);
        }
      }
      updateTile("day" + prefs.weDay, "success", "fas fa-check-circle");
    } catch(err) {
      notifyUser("error", "errorGetWeMedia", null, true, err, true);
      updateTile("day" + prefs.weDay, "danger", "fas fa-times-circle");
    }
  }
}
function isReachable(hostname, port) {
  return new Promise(resolve => {
    try {
      let client = net.createConnection(port, hostname);
      client.setTimeout(3000);
      client.on("timeout", () => {
        client.destroy("Timeout: " + hostname + ":" + port);
      });
      client.on("connect", function() {
        client.destroy();
        resolve(true);
      });
      client.on("error", function(err) {
        notifyUser("error", "errorSiteCheck", hostname + ":" + port, false, err);
        resolve(false);
      });
    } catch(err) {
      resolve(false);
    }
  });
}
function mkdirSync(dirPath) {
  try {
    fs.mkdirSync(dirPath, {
      recursive: true
    });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}
async function mp4Convert() {
  perf("mp4Convert", "start");
  updateStatus("file-video");
  updateTile("mp4Convert", "warning", "fas fa-circle-notch fa-spin");
  await convertUnusableFiles();
  var filesToProcess = glob.sync(path.join(paths.media, "*", "*"), {
    ignore: path.join(paths.media, "*", "*.mp4")
  });
  totals.mp4Convert = {
    total: filesToProcess.length,
    current: 1
  };
  progressSet(totals.mp4Convert.current, totals.mp4Convert.total, "mp4Convert");
  for (var mediaFile of filesToProcess) {
    await createVideoSync(mediaFile);
    totals.mp4Convert.current++;
    progressSet(totals.mp4Convert.current, totals.mp4Convert.total, "mp4Convert");
  }
  updateTile("mp4Convert", "success", "fas fa-check-circle");
  perf("mp4Convert", "stop");
}
function notifyUser(type, message, fileOrUrl, persistent, errorFedToMe, action) {
  let icon;
  switch (type) {
  case "error":
    icon = "fa-exclamation-circle text-danger";
    break;
  case "warn":
    icon = "fa-exclamation-circle text-warning";
    break;
  default:
    icon = "fa-info-circle text-primary";
  }
  if (fileOrUrl) fileOrUrl = escape(fileOrUrl);
  if (["error", "warn"].includes(type)) log[type](fileOrUrl ? fileOrUrl : "", errorFedToMe ? errorFedToMe : "");
  type = i18n.__(type);
  let thisBugUrl = bugUrl() + (errorFedToMe ? encodeURIComponent("\n### Error details\n```\n" + JSON.stringify(errorFedToMe, Object.getOwnPropertyNames(errorFedToMe), 2) + "\n```\n").replace(/\n/g, "%0D%0A") : "");
  $("#toastContainer").append($("<div class='toast' role='alert' data-bs-autohide='" + !persistent + "' data-bs-delay='10000'><div class='toast-header'><i class='fas " + icon + "'></i><strong class='me-auto ms-2'>" + type + "</strong><button type='button' class='btn-close' data-bs-dismiss='toast'></button></div><div class='toast-body'><p>" + i18n.__(message) + "</p>" + (fileOrUrl ? "<code>" + fileOrUrl + "</code>" : "") + (action ? "<div class='mt-2 pt-2 border-top'><button type='button' class='btn btn-primary btn-sm toast-action' " + (action ? "data-toast-action-url='" + escape((action && action.url ? action.url : thisBugUrl)) + "'" :"") + ">" + i18n.__(action && action.desc ? action.desc : "reportIssue") + "</button></div>" : "") + "</div></div>").toast("show"));
}
function overlay(show, topIcon, bottomIcon, action) {
  return new Promise((resolve) => {
    if (!show) {
      if (!topIcon || (topIcon && $("#overlayMaster i.fa-" + topIcon).length > 0)) $("#overlayMaster").stop().fadeOut(fadeDelay, () => resolve());
    } else {
      if ($("#overlayMaster #topIcon i.fa-" + topIcon).length === 0) $("#overlayMaster #topIcon i").removeClass().addClass("fas fa-fw fa-" + topIcon);
      $("#overlayMaster #bottomIcon i").removeClass();
      if (bottomIcon) {
        $("#overlayMaster #bottomIcon i").addClass("fas fa-fw fa-" + bottomIcon + (action ? " " + action : "")).unwrap("button");
        $("#overlayMaster #bottomIcon button .action-countdown").html();
        if (action) $("#overlayMaster #bottomIcon i").next("span").addBack().wrapAll("<button type='button' class='btn btn-danger btn-action-" + action + " position-relative'></button>");
      }
      $("#overlayMaster").stop().fadeIn(fadeDelay, () => resolve());
    }
  });
}
function perf(func, op) {
  if (!perfStats[func]) perfStats[func] = {};
  perfStats[func][op] = performance.now();
}
function perfPrint() {
  for (var perfItem of Object.entries(perfStats).sort((a, b) => a[1].stop - b[1].stop)) {
    log.info("%c[perf] [" + perfItem[0] + "] " + (perfItem[1].stop - perfItem[1].start).toFixed(1) + "ms", "background-color: #e2e3e5; color: #41464b;");
  }
  for (let downloadSource of Object.entries(downloadStats)) {
    log.info("%c[perf] [" + downloadSource[0] + "Fetch] " + Object.entries(downloadSource[1]).sort((a,b) => a[0].localeCompare(b[0])).map(downloadOrigin => "from " + downloadOrigin[0] + ": " + (downloadOrigin[1].map(source => source.filesize).reduce((a, b) => a + b, 0) / 1024 / 1024).toFixed(1) + "MB").join(", "), "background-color: #fbe9e7; color: #000;");
  }
}
function prefsInitialize() {
  for (var pref of ["localAppLang", "lang", "mwDay", "weDay", "autoStartSync", "autoRunAtBoot", "autoQuitWhenDone", "localOutputPath", "enableMp4Conversion", "congServer", "congServerPort", "congServerUser", "congServerPass", "autoOpenFolderWhenDone", "localAdditionalMediaPrompt", "maxRes", "enableMusicButton", "enableMusicFadeOut", "musicFadeOutTime", "musicFadeOutType", "mwStartTime", "weStartTime", "excludeTh", "excludeLffi", "excludeLffiImages"]) {
    if (!(Object.keys(prefs).includes(pref)) || !prefs[pref]) prefs[pref] = null;
  }
  for (let field of ["localAppLang", "lang", "localOutputPath", "congServer", "congServerUser", "congServerPass", "congServerPort", "congServerDir", "musicFadeOutTime", "mwStartTime", "weStartTime"]) {
    $("#" + field).val(prefs[field]);
  }
  for (let timeField of ["mwStartTime", "weStartTime"]) {
    $(".timePicker").filter("[data-target='" + timeField + "']").val($("#" + timeField).val());
  }
  for (let dtPicker of datepickers) {
    dtPicker.setDate($(dtPicker.element).val());
  }
  for (let checkbox of ["autoStartSync", "autoRunAtBoot", "enableMp4Conversion", "autoQuitWhenDone", "autoOpenFolderWhenDone", "localAdditionalMediaPrompt", "enableMusicButton", "enableMusicFadeOut", "excludeTh", "excludeLffi", "excludeLffiImages"]) {
    $("#" + checkbox).prop("checked", prefs[checkbox]);
  }
  for (let radioSel of ["mwDay", "weDay", "maxRes", "musicFadeOutType"]) {
    $("#" + radioSel + " input[value=" + prefs[radioSel] + "]").prop("checked", true);
  }
}
function progressSet(current, total, blockId) {
  if (!dryrun || !blockId) {
    let percent = current / total * 100;
    if (percent > 100 || (!blockId && percent === 100)) percent = 0;
    remote.getCurrentWindow().setProgressBar(percent / 100);
    $("#" + (blockId ? blockId + " .progress-bar" : "globalProgress")).width(percent + "%");
  }
}
function removeEventListeners() {
  document.removeEventListener("drop", dropHandler);
  document.removeEventListener("dragover", dragoverHandler);
  document.removeEventListener("dragenter", dragenterHandler);
  document.removeEventListener("dragleave", dragleaveHandler);
}
async function request(url, opts) {
  let response = null,
    payload,
    options = opts ? opts : {};
  try {
    if (options.webdav) options.auth = {
      username: prefs.congServerUser,
      password: prefs.congServerPass
    };
    if (options.isFile) {
      options.responseType = "arraybuffer";
      options.onDownloadProgress = progressEvent => progressSet(progressEvent.loaded, progressEvent.total);
    }
    if (options.noCache) {
      options.headers = {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Expires": "0",
      };
    }
    if (options.method === "PUT") options.onUploadProgress = progressEvent => progressSet(progressEvent.loaded, progressEvent.total);
    if (["jw.org", "www.jw.org"].includes((new URL(url)).hostname)) options.adapter = require("axios/lib/adapters/http");
    options.url = url;
    if (!options.method) options.method = "GET";
    payload = await axios.request(options);
    response = payload;
  } catch (err) {
    response = (err.response ? err.response : err);
    if (response.config.url && response.data) response = {
      url: response.config.url,
      data: response.data,
      status: response.status
    };
    log.error(response);
    if (options.webdav) throw(response);
  }
  return response;
}
function sanitizeFilename(filename, isNotFile) {
  let fileExtIfApplicable = (isNotFile ? "" : path.extname(filename).toLowerCase());
  filename = path.basename(filename, (isNotFile ? "" : path.extname(filename))).replace(/["»“”‘’«()№+[\]$<>,/\\:*\x00-\x1f\x80-\x9f]/g, "").replace(/ *[—?;:|.!?] */g, " - ").trim().replace(/[ -]+$/g, "") + fileExtIfApplicable;
  if (!isNotFile && paths.media) {
    let maxCharactersInPath = 245,
      projectedPathCharLength = path.join(paths.media, "9999-99-99", filename).length;
    if (projectedPathCharLength > maxCharactersInPath) {
      filename = path.basename(filename, (isNotFile ? "" : path.extname(filename))).slice(0, -(projectedPathCharLength - maxCharactersInPath)).trim() + fileExtIfApplicable;
    }
    let currentBytes = Buffer.byteLength(filename, "utf8");
    while (currentBytes > 200) {
      filename = path.basename(filename, (isNotFile ? "" : path.extname(filename))).slice(0, -1).trim() + fileExtIfApplicable;
      currentBytes = Buffer.byteLength(filename, "utf8");
    }
  }
  return path.basename(filename, (isNotFile ? "" : path.extname(filename))) + fileExtIfApplicable;
}
async function setMediaLang() {
  if (prefs.lang) {
    try {
      $("#songPicker").empty();
      for (let sjj of (await getMediaLinks("sjjm", null, null, "MP4"))) {
        $("#songPicker").append($("<option>", {
          value: sjj.url,
          text: sjj.title,
          "data-thumbnail": sjj.trackImage
        }));
      }
    } catch (err) {
      $("label[for=typeSong]").removeClass("active").addClass("disabled");
      $("label[for=typeFile]").click().addClass("active");
    }
    $("#lang").val(prefs.lang).select2("destroy").select2();
    let currentJwLang = jsonLangs.filter(item => item.langcode == prefs.lang);
    $(".jwLang small").text(currentJwLang.length == 1 && currentJwLang[0].vernacularName ? "(" + currentJwLang[0].vernacularName + ")" : "");
  }
}
function setVars(isDryrun) {
  if (prefs.localOutputPath && prefs.lang) {
    perf("setVars", "start");
    try {
      downloadStats = {};
      meetingMedia = {};
      jwpubDbs = {};
      paths.media = path.join(prefs.localOutputPath, prefs.lang);
      if (!isDryrun) mkdirSync(paths.media);
      paths.pubs = path.join(paths.app, "Publications", prefs.lang);
    } catch (err) {
      notifyUser("error", "errorSetVars", paths.media, true, err);
    }
    perf("setVars", "stop");
  }
}
function showModal(isVisible, header, headerContent, bodyContent, footer, footerButtonEnabled) {
  if (isVisible) {
    $("#staticBackdrop .modal-header").html(header ? "<h5 class='modal-title'>" + headerContent + "</h5>" : "").toggle(header);
    $("#staticBackdrop .modal-body").html(bodyContent);
    if (footer) $("#staticBackdrop .modal-footer").html($("<button type='button' class='btn btn-primary' data-bs-dismiss='modal'><i class='fas fa-fw fa-check'></i></button>").prop("disabled", !footerButtonEnabled));
    $("#staticBackdrop .modal-footer").toggle(footer);
    modal.show();
  } else {
    modal.hide();
  }
}
async function startMediaSync(isDryrun) {
  perf("total", "start");
  dryrun = !!isDryrun;
  if (!dryrun) $("#statusIcon").toggleClass("text-primary text-muted fa-flip");
  stayAlive = false;
  if (!dryrun) $("#btn-settings" + (prefs.congServer && prefs.congServer.length > 0 ? ", #btn-upload" : "")).fadeTo(fadeDelay, 0);
  await setVars(isDryrun);
  for (let folder of glob.sync(path.join(paths.media, "*/"))) {
    if (!dryrun && (dayjs(path.basename(folder), "YYYY-MM-DD").isValid() && dayjs(path.basename(folder), "YYYY-MM-DD").isBefore(now) || !(dayjs(path.basename(folder), "YYYY-MM-DD").isValid()))) await rm([folder]);
  }
  perf("getJwOrgMedia", "start");
  updateStatus("globe-americas");
  await Promise.all([
    getMwMediaFromDb(),
    getWeMediaFromDb()
  ]);
  perf("getJwOrgMedia", "stop");
  createMediaNames();
  if (webdavIsAGo) await getCongMedia();
  if (!dryrun) {
    updateStatus("download");
    await Promise.all([
      syncCongMedia(),
      syncJwOrgMedia(),
    ]);
    if (prefs.localAdditionalMediaPrompt) await additionalMedia();
    if (prefs.enableMp4Conversion) await mp4Convert();
    if (prefs.autoOpenFolderWhenDone) shell.openPath(paths.media);
    $("#btn-settings" + (prefs.congServer && prefs.congServer.length > 0 ? ", #btn-upload" : "")).fadeTo(fadeDelay, 1);
    setTimeout(() => {
      $(".alertIndicators").addClass("alert-primary").removeClass("alert-success");
      $("#statusIcon").toggleClass("text-muted text-primary fa-flip");
      updateStatus("photo-video");
    }, 2000);
  }
  perf("total", "stop");
  perfPrint();
  /*
  let logObj = Object.entries(logOutput).map(logLevel => Object.entries(logLevel[1]).map(logItem => [logItem[0], logLevel[0], logItem[1]])).flat().sort();
  console.log((await request("https://pastebin.com/api/api_post.php", {
    method: "POST",
    data: new URLSearchParams({
      api_dev_key: "4fe0d5da994143b504443b806aef6a87",
      api_paste_code: JSON.stringify(logObj, null, 2),
      api_option: "paste",
      api_paste_format: "json",
      api_paste_expire_date: "1M"
    }).toString()
  })).data);
  */
}
async function syncCongMedia() {
  let congSyncMeetingMedia = Object.fromEntries(Object.entries(meetingMedia).filter(([key]) => key !== "Recurring"));
  if (webdavIsAGo) {
    perf("syncCongMedia", "start");
    try {
      totals.cong = {
        total: Object.values(congSyncMeetingMedia).map(parts => Object.values(parts).map(part => part.media.filter(mediaItem => mediaItem.congSpecific && !mediaItem.hidden).length)).flat().reduce((previousValue, currentValue) => previousValue + currentValue),
        current: 1
      };
      for (let datedFolder of await glob.sync(path.join(paths.media, "*/"))) {
        if (congSyncMeetingMedia[path.basename(datedFolder)]) for (let jwOrCongFile of await glob.sync(path.join(datedFolder, "*"))) {
          if (!congSyncMeetingMedia[path.basename(datedFolder)].map(part => part.media.filter(media => !media.hidden).map(media => media.safeName)).flat().includes(path.basename(jwOrCongFile))) await rm(jwOrCongFile);
        }
      }
      progressSet(totals.cong.current, totals.cong.total, "specificCong");
      for (let [meeting, parts] of Object.entries(congSyncMeetingMedia)) {
        for (let part of parts) {
          for (var mediaItem of part.media.filter(mediaItem => mediaItem.congSpecific && !mediaItem.hidden)) {
            log.info("%c[congMedia] [" + meeting + "] " + mediaItem.safeName, "background-color: #d1ecf1; color: #0c5460");
            await webdavGet(mediaItem);
            totals.cong.current++;
            progressSet(totals.cong.current, totals.cong.total, "specificCong");
          }
        }
      }
      updateTile("specificCong", "success", "fas fa-check-circle");
    } catch (err) {
      notifyUser("error", "errorSyncCongMedia", null, true, err, true);
      updateTile("specificCong", "danger", "fas fa-times-circle");
      progressSet(0, 100, "specificCong");
    }
    perf("syncCongMedia", "stop");
  }
}
async function syncJwOrgMedia() {
  perf("syncJwOrgMedia", "start");
  updateTile("syncJwOrgMedia", "warning", "fas fa-circle-notch fa-spin");
  totals.jw = {
    total: Object.values(meetingMedia).map(meeting => Object.values(meeting).map(part => part.media.filter(mediaItem => !mediaItem.congSpecific).length)).flat().reduce((previousValue, currentValue) => previousValue + currentValue),
    current: 1
  };
  progressSet(totals.jw.current, totals.jw.total, "syncJwOrgMedia");
  for (var h = 0; h < Object.values(meetingMedia).length; h++) { // meetings
    var meeting = Object.values(meetingMedia)[h];
    for (var i = 0; i < meeting.length; i++) { // parts
      var partMedia = meeting[i].media.filter(mediaItem => !mediaItem.congSpecific);
      for (var j = 0; j < partMedia.length; j++) { // media
        if (!partMedia[j].hidden && !partMedia[j].congSpecific && !dryrun) {
          if (!partMedia[j].filesize) {
            notifyUser("warn", "warnFileNotAvailable", [partMedia[j].queryInfo.KeySymbol, partMedia[j].queryInfo.Track, partMedia[j].queryInfo.IssueTagNumber].filter(Boolean).join("_"), true, partMedia[j]);
          } else {
            log.info("%c[jwOrg] [" + Object.keys(meetingMedia)[h] + "] " + partMedia[j].safeName, "background-color: #cce5ff; color: #004085;");
            if (partMedia[j].url) {
              await downloadIfRequired(partMedia[j]);
            } else {
              mkdirSync(path.join(paths.media, partMedia[j].folder));
              var destFile = path.join(paths.media, partMedia[j].folder, partMedia[j].safeName);
              if (!fs.existsSync(destFile) || fs.statSync(destFile).size !== partMedia[j].filesize) fs.copyFileSync(partMedia[j].filepath, destFile);
            }
          }
        }
        totals.jw.current++;
        progressSet(totals.jw.current, totals.jw.total, "syncJwOrgMedia");
      }
    }
  }
  updateTile("syncJwOrgMedia", "success", "fas fa-check-circle");
  perf("syncJwOrgMedia", "stop");
}
async function testJwmmf() {
  logLevel = "debug";
  let previousLang = prefs.lang;
  for (var lang of ["E", "F", "M", "R", "S", "T", "U", "X"] ) {
    prefs.lang = lang;
    await startMediaSync(true);
  }
  prefs.lang = previousLang;
  logLevel = "info";
}
function toggleScreen(screen, forceShow) {
  return new Promise((resolve) => {
    if (screen === "overlaySettings" && !$("#" + screen).is(":visible")) $("#" + screen + " .accordion-collapse").each(function() {
      $(this).collapse($(this).find(".is-invalid").length > 0 ? "show" : "hide");
    });
    if (forceShow) {
      $("#" + screen).slideDown(fadeDelay, () => resolve() );
    } else {
      $("#" + screen).slideToggle(fadeDelay, () => resolve() );
    }
  });
}
function updateCleanup() {
  try { // do some housecleaning after version updates
    var lastRunVersion = 0;
    if (fs.existsSync(paths.lastRunVersion)) lastRunVersion = fs.readFileSync(paths.lastRunVersion, "utf8");
  } catch(err) {
    notifyUser("warn", "warnUnknownLastVersion", null, false, err);
  } finally {
    if (lastRunVersion !== currentAppVersion) {
      setVars();
      //rm([paths.media]);
      fs.writeFileSync(paths.lastRunVersion, currentAppVersion);
      if (lastRunVersion !== 0) {
        let somePrefWasUpdated = false;
        for (var updatedPref of [["additionalMediaPrompt", "localAdditionalMediaPrompt"], ["betaMp4Gen", "enableMp4Conversion"], ["outputPath", "localOutputPath"], ["openFolderWhenDone", "autoOpenFolderWhenDone"]]) {
          if (updatedPref[0] in prefs) {
            prefs[updatedPref[1]] = prefs[updatedPref[0]];
            delete prefs[updatedPref[0]];
            prefsInitialize();
            somePrefWasUpdated = true;
          }
        }
        if (!prefs.localAppLang) {
          prefs.localAppLang = jsonLangs.filter(item => item.langcode === prefs.lang)[0].symbol;
          somePrefWasUpdated = true;
          prefsInitialize();
          setAppLang();
        }
        validateConfig(somePrefWasUpdated);
        notifyUser("info", "updateInstalled", currentAppVersion, false, null, {desc: "moreInfo", url: "https://github.com/sircharlo/jw-meeting-media-fetcher/releases/latest"});
        let currentLang = jsonLangs.filter(item => item.langcode === prefs.lang)[0];
        if (prefs.lang && currentLang && !fs.readdirSync(path.join(__dirname, "locales")).map(file => file.replace(".json", "")).includes(currentLang.symbol)) notifyUser("wannaHelp", i18n.__("wannaHelpExplain") + "<br/><small>" +  i18n.__("wannaHelpWillGoAway") + "</small>", currentLang.name + " (" + currentLang.langcode + "/" + currentLang.symbol + ")", true, null, {
          desc: "wannaHelpForSure",
          url: "https://github.com/sircharlo/jw-meeting-media-fetcher/discussions/new?category=translations&title=New+translation+in+" + currentLang.name + "&body=I+would+like+to+help+to+translate+JWMMF+into+a+language+I+speak,+" + currentLang.name + " (" + currentLang.langcode + "/" + currentLang.symbol + ")."
        });
        getJwOrgLanguages(true).then(function() {
          setMediaLang();
        });
      }
    }
  }
}
function updateStatus(icon) {
  if (!dryrun) $("#statusIcon").removeClass($("#statusIcon").attr("class").split(" ").filter(el => !["fa-fw", "fa-3x", "fa-flip"].includes(el) && el.includes("fa-")).join(" ")).addClass("fa-" + icon);
}
function updateTile(tile, color, icon) {
  if (!dryrun) $("#" + tile).removeClass($("#" + tile).attr("class").split(" ").filter(el => el.includes("alert-")).join(" ")).addClass("alert-" + color).find("i").removeClass().addClass(icon);
}
function validateConfig(changed) {
  let configIsValid = true;
  $(".alertIndicators").removeClass("meeting");
  if (prefs.localOutputPath === "false" || !fs.existsSync(prefs.localOutputPath)) $("#localOutputPath").val("");
  let mandatoryFields = ["localOutputPath", "localAppLang", "lang", "mwDay", "weDay", "maxRes"];
  for (let timeField of ["mwStartTime", "weStartTime"]) {
    if (prefs.enableMusicButton && prefs.enableMusicFadeOut && prefs.musicFadeOutType === "smart") mandatoryFields.push(timeField);
    else $("#" + timeField + ", .timePicker[data-target='" + timeField + "']").removeClass("is-invalid");
  }
  for (var setting of mandatoryFields) {
    if (setting.includes("Day")) $("#day" + prefs[setting]).addClass("meeting");
    $("#" + setting + ", .timePicker[data-target='" + setting + "']").toggleClass("is-invalid", !prefs[setting]);
    $("#" + setting).next(".select2").toggleClass("is-invalid", !prefs[setting]);
    $("#" + setting + " label.btn").toggleClass("btn-outline-dark", !!prefs[setting]).toggleClass("btn-outline-danger", !prefs[setting]);
    $("#" + setting).closest("div.row").find("label").toggleClass("text-danger", !prefs[setting]);
    if (!prefs[setting]) configIsValid = false;
  }
  $("#enableMusicFadeOut").closest(".row").toggle(!!prefs.enableMusicButton);
  $(".relatedToFadeOut").toggle(!!prefs.enableMusicButton && !!prefs.enableMusicFadeOut);
  $("#enableMusicFadeOut").closest(".row").find("label").first().toggleClass("col-11", prefs.enableMusicButton && !prefs.enableMusicFadeOut);
  if (prefs.enableMusicButton && prefs.enableMusicFadeOut) {
    if (!prefs.musicFadeOutTime) $("#musicFadeOutTime").val(5).change();
    if (!prefs.musicFadeOutType) $("label[for=musicFadeOutSmart]").click();
  }
  $("#musicFadeOutType label span").text(prefs.musicFadeOutTime);
  $("#mp4Convert").toggleClass("d-flex", prefs.enableMp4Conversion);
  $("#btnMeetingMusic").toggle(!!prefs.enableMusicButton && $("#btnStopMeetingMusic:visible").length === 0);
  $(".btn-home").toggleClass("btn-dark", configIsValid).toggleClass("btn-danger", !configIsValid);
  $("#mediaSync, .btn-home").prop("disabled", !configIsValid);
  if (!configIsValid) {
    toggleScreen("overlaySettings", true);
  } else if (changed) {
    fs.writeFileSync(paths.prefs, JSON.stringify(Object.keys(prefs).sort().reduce((acc, key) => ({...acc, [key]: prefs[key]}), {}), null, 2));
  }
  return configIsValid;
}
async function webdavExists(url) {
  return (await webdavStatus(url)) < 400;
}
async function webdavGet(file) {
  let localFile = path.join(paths.media, file.folder, file.safeName);
  if (!fs.existsSync(localFile) || !(file.filesize == fs.statSync(localFile).size)) {
    mkdirSync(path.join(paths.media, file.folder));
    let perf = {
      start: performance.now(),
      bytes: file.filesize,
      name: file.safeName
    };
    let remoteFile = await request("https://" + prefs.congServer + ":" + prefs.congServerPort + file.url, {
      webdav: true,
      isFile: true
    });
    perf.end = performance.now();
    perf.bits = perf.bytes * 8;
    perf.ms = perf.end - perf.start;
    perf.s = perf.ms / 1000;
    perf.bps = perf.bits / perf.s;
    perf.mbps = perf.bps / 1000000;
    perf.dir = "down";
    log.debug(perf);
    fs.writeFileSync(localFile, new Buffer(remoteFile.data));
    downloadStat("cong", "live", file);
  } else {
    downloadStat("cong", "cache", file);
  }
}
async function webdavLs(dir, force) {
  let items = [],
    congUrl = "https://" + prefs.congServer + ":" + prefs.congServerPort + dir;
  try {
    if (webdavIsAGo || force) {
      await webdavMkdir(dir);
      let listing = new XMLParser({removeNSPrefix: true}).parse((await request(congUrl, {
        method: "PROPFIND",
        responseType: "text",
        headers: {
          Accept: "text/plain",
          Depth: "1"
        },
        webdav: true
      })).data);
      if (listing && listing.multistatus && listing.multistatus.response && Array.isArray(listing.multistatus.response)) {
        items = listing.multistatus.response.filter(item => path.resolve(decodeURIComponent(item.href)) !== path.resolve(dir)).map(item => {
          let href = decodeURIComponent(item.href);
          return {
            filename: href,
            basename: path.basename(href),
            type: typeof item.propstat.prop.resourcetype === "object" && "collection" in item.propstat.prop.resourcetype ? "directory" : "file",
            size: item.propstat.prop.getcontentlength ? item.propstat.prop.getcontentlength : 0
          };
        }).sort((a, b) => a.basename.localeCompare(b.basename));
      }
      return items;
    }
  } catch (err) {
    notifyUser("error", "errorWebdavLs", congUrl, true, err);
    return items;
  }
}
async function webdavMkdir(dir) {
  if (!(await webdavExists(dir))) await request("https://" + prefs.congServer + ":" + prefs.congServerPort + dir, {
    method: "MKCOL",
    webdav: true
  });
}
async function webdavMv(src, dst) {
  try {
    let congServerAddress = "https://" + prefs.congServer + ":" + prefs.congServerPort;
    if (await webdavExists(dst)) {
      throw("File overwrite not allowed.");
    } else if (await webdavExists(src)) await request(congServerAddress + src, {
      method: "MOVE",
      headers: {
        "Destination": congServerAddress + encodeURI(dst)
      },
      webdav: true
    });
    return true;
  } catch (err) {
    notifyUser("error", "errorWebdavPut", src + " => " + dst, true, err);
    return false;
  }
}
async function webdavPut(file, destFolder, destName) {
  let destFile = path.posix.join("https://" + prefs.congServer + ":" + prefs.congServerPort, destFolder, (await sanitizeFilename(destName)));
  try {
    if (webdavIsAGo && file && destFolder && destName) {
      await webdavMkdir(destFolder);
      let perf = {
        start: performance.now(),
        bytes: file.byteLength,
        name: destName
      };
      await request(destFile, {
        method: "PUT",
        data: file,
        headers: {
          "Content-Type": "application/octet-stream"
        },
        webdav: true
      });
      perf.end = performance.now();
      perf.bits = perf.bytes * 8;
      perf.ms = perf.end - perf.start;
      perf.s = perf.ms / 1000;
      perf.bps = perf.bits / perf.s;
      perf.mbps = perf.bps / 1000000;
      perf.dir = "up";
      log.debug(perf);
    }
    return true;
  } catch (err) {
    notifyUser("error", "errorWebdavPut", destFile, true, err);
    return false;
  }
}
async function webdavRm(path) {
  let deleteFile = "https://" + prefs.congServer + ":" + prefs.congServerPort + path;
  try {
    if (webdavIsAGo && path && await webdavExists(path)) {
      await request(deleteFile, {
        method: "DELETE",
        webdav: true
      });
    }
    return true;
  } catch (err) {
    notifyUser("error", "errorWebdavRm", deleteFile, true, err);
    return false;
  }
}
async function webdavSetup() {
  let congServerEntered = !!(prefs.congServer && prefs.congServer.length > 0);
  let congServerHeartbeat = false;
  let webdavLoginSuccessful = false;
  let webdavDirIsValid = false;
  $("#webdavFolderList").empty();
  if (congServerEntered && prefs.congServerPort) {
    congServerHeartbeat = await isReachable(prefs.congServer, prefs.congServerPort);
    if (congServerHeartbeat) {
      if (prefs.congServerUser && prefs.congServerPass) {
        if (prefs.congServerDir == null || prefs.congServerDir.length === 0) {
          $("#congServerDir").val("/").change();
        } else {
          let webdavStatusCode = await webdavStatus(prefs.congServerDir);
          if (webdavStatusCode === 200) {
            webdavLoginSuccessful = true;
            webdavDirIsValid = true;
          }
          if (!([401, 403, 405, 429].includes(webdavStatusCode))) webdavLoginSuccessful = true;
          if (webdavStatusCode !== 404) webdavDirIsValid = true;
          if (congServerHeartbeat && webdavLoginSuccessful && webdavDirIsValid) {
            if (prefs.congServerDir !== "/") $("#webdavFolderList").append("<li><i class='fas fa-fw fa-chevron-circle-up'></i> ../ </li>");
            for (var item of (await webdavLs(prefs.congServerDir, true))) {
              if (item.type == "directory") $("#webdavFolderList").append("<li><i class='fas fa-fw fa-folder-open'></i>" + item.basename + "</li>");
            }
            $("#webdavFolderList").css("column-count", Math.ceil($("#webdavFolderList li").length / 8));
            $("#webdavFolderList li").click(function() {
              $("#congServerDir").val(path.posix.join(prefs.congServerDir, $(this).text().trim())).change();
            });
            if (prefs.localAdditionalMediaPrompt) $("#localAdditionalMediaPrompt").prop("checked", false).change();
            enforcePrefs();
            disableGlobalPref(["localAdditionalMediaPrompt", false]);
          }
        }
      }
    }
  }
  $("#btn-upload").toggle(congServerEntered).prop("disabled", congServerEntered && !webdavDirIsValid).toggleClass("btn-primary", !congServerEntered || (congServerEntered && webdavLoginSuccessful && webdavDirIsValid)).toggleClass("btn-danger", congServerEntered && !(webdavDirIsValid && webdavLoginSuccessful));
  $("#webdavStatus").toggleClass("text-success text-warning text-muted", webdavDirIsValid).toggleClass("text-danger", congServerEntered && !webdavDirIsValid);
  $(".webdavHost").toggleClass("is-valid", congServerHeartbeat).toggleClass("is-invalid", congServerEntered && !congServerHeartbeat);
  $(".webdavCreds").toggleClass("is-valid", congServerHeartbeat && webdavLoginSuccessful).toggleClass("is-invalid", (congServerEntered && congServerHeartbeat && !webdavLoginSuccessful));
  $("#congServerDir").toggleClass("is-valid", congServerHeartbeat && webdavLoginSuccessful && webdavDirIsValid).toggleClass("is-invalid", (congServerEntered && congServerHeartbeat && webdavLoginSuccessful && !webdavDirIsValid));
  $("#webdavFolderList").fadeTo(fadeDelay, webdavDirIsValid);
  $("#specificCong").toggleClass("d-flex", congServerEntered).toggleClass("alert-danger", congServerEntered && !(congServerHeartbeat && webdavLoginSuccessful && webdavDirIsValid));
  $("#btn-settings, #headingCongSync button").toggleClass("in-danger", congServerEntered && !webdavDirIsValid);
  webdavIsAGo = (congServerEntered && congServerHeartbeat && webdavLoginSuccessful && webdavDirIsValid);
  $("#localAdditionalMediaPrompt").closest(".row").toggle(!webdavIsAGo);
  $("#btnForcedPrefs").prop("disabled", !webdavIsAGo);
  if (!webdavIsAGo) enablePreviouslyForcedPrefs();
}
async function webdavStatus(url) {
  let response;
  try {
    response = await request("https://" + prefs.congServer + ":" + prefs.congServerPort + url, {
      method: "PROPFIND",
      responseType: "text",
      headers: {
        Accept: "text/plain",
        Depth: "1"
      },
      webdav: true
    });
  } catch (err) {
    response = (err.response ? err.response : err);
  }
  return response.status;
}
var dragenterHandler = () => {
  if ($("input#typeFile:checked").length > 0 || $("input#typeJwpub:checked").length > 0) $(".dropzone").css("display", "block");
};
var dragleaveHandler = (event) => {
  if (event.target.id == "dropzone") $(".dropzone").css("display", "none");
};
var dragoverHandler = (e) => {
  e.preventDefault();
  e.stopPropagation();
};
var dropHandler = (event) => {
  event.preventDefault();
  event.stopPropagation();
  var filesDropped = [];
  for (const f of event.dataTransfer.files) {
    filesDropped.push(f.path);
  }
  if ($("input#typeFile:checked").length > 0) {
    $("#filePicker").val(filesDropped.join(" -//- ")).change();
  } else if ($("input#typeJwpub:checked").length > 0) {
    $("#jwpubPicker").val(filesDropped.filter(filepath => path.extname(filepath) == ".jwpub")[0]).change();
  }
  $(".dropzone").css("display", "none");
};
$(document).on("select2:open", () => {
  document.querySelector(".select2-search__field").focus();
});
$("#autoRunAtBoot").on("change", function() {
  remote.app.setLoginItemSettings({
    openAtLogin: prefs.autoRunAtBoot
  });
});
$("#baseDate").on("click", ".dropdown-item", function() {
  let newBaseDate = dayjs($(this).val()).startOf("isoWeek");
  if (!baseDate.isSame(newBaseDate)) {
    baseDate = newBaseDate;
    $(".alertIndicators i").addClass("far fa-circle").removeClass("fas fa-check-circle");
    $("#baseDate .dropdown-item.active").removeClass("active");
    $(this).addClass("active");
    $("#baseDate > button").text($(this).text());
    dateFormatter();
  }
});
$("#btnCancelUpload").on("click", () => {
  toggleScreen("overlayUploadFile");
  $("#chooseMeeting input:checked, #chooseUploadType input:checked").prop("checked", false);
  $("#fileList, #filePicker, #jwpubPicker, .enterPrefixInput").val("").empty().change();
  $("#chooseMeeting .active, #chooseUploadType .active").removeClass("active");
  removeEventListeners();
});
$("#btnForcedPrefs").on("click", () => {
  getForcedPrefs().then(currentForcedPrefs => {
    let html = "<h6>" + i18n.__("settingsLockedWhoAreYou") + "</h6>";
    html += "<p>" + i18n.__("settingsLockedExplain") + "</p>";
    html += "<div id='forcedPrefs' class='card'><div class='card-body'>";
    for (var pref of Object.keys(prefs).filter(pref => !pref.startsWith("cong") && !pref.startsWith("auto") && !pref.startsWith("local") && !pref.includes("UpdatedLast")).sort((a, b) => a[0].localeCompare(b[0]))) {
      html += "<div class='form-check form-switch'><input class='form-check-input' type='checkbox' id='forcedPref-" + pref + "' " + (pref in currentForcedPrefs ? "checked" : "") + "> <label class='form-check-label' for='forcedPref-" + pref + "'><code>" + pref + "</code> <i class='fas fa-question-circle text-muted' title='\"" + $("#" + pref).closest(".row").find("label").first().find("span").last().html() + "\"' data-bs-toggle='tooltip' data-bs-html='true'></i></label></div>";
    }
    html += "</div></div>";
    showModal(true, true, i18n.__("settingsLocked"), html, true, true);
    $("#staticBackdrop #forcedPrefs i").tooltip();
    $("#staticBackdrop #forcedPrefs input").on("change", async function() {
      $("#staticBackdrop #forcedPrefs input").prop("disabled", true);
      let checkedItems = $("#staticBackdrop #forcedPrefs input:checked").map(function() { return this.id.replace("forcedPref-", ""); }).get();
      let forcedPrefs = JSON.stringify(Object.fromEntries(Object.entries(prefs).filter(([key]) => checkedItems.includes(key))), null, 2);
      if (await webdavPut(forcedPrefs, prefs.congServerDir, "forcedPrefs.json")) {
        enablePreviouslyForcedPrefs();
        enforcePrefs();
      } else {
        $(this).prop("checked", !$(this).prop("checked"));
      }
      $("#staticBackdrop #forcedPrefs input").prop("disabled", false);
    });
  });
});
$("#btnMeetingMusic").on("click", async function() {
  if (prefs.enableMusicFadeOut) {
    let timeBeforeFade;
    let rightNow = dayjs();
    if (prefs.musicFadeOutType == "smart") {
      if ((now.day() - 1) == prefs.mwDay || (now.day() - 1) == prefs.weDay) {
        let todaysMeetingStartTime = prefs[((now.day() - 1) == prefs.mwDay ? "mw" : "we") + "StartTime"].split(":");
        let timeToStartFading = now.clone().hour(todaysMeetingStartTime[0]).minute(todaysMeetingStartTime[1]).millisecond(rightNow.millisecond()).subtract(prefs.musicFadeOutTime, "s");
        timeBeforeFade = timeToStartFading.diff(rightNow);
      }
    } else {
      timeBeforeFade = prefs.musicFadeOutTime * 1000 * 60;
    }
    if (timeBeforeFade >= 0) {
      pendingMusicFadeOut.endTime = timeBeforeFade + rightNow.valueOf();
      pendingMusicFadeOut.id = setTimeout(function () {
        $("#btnStopMeetingMusic").click();
      }, timeBeforeFade);
    } else {
      pendingMusicFadeOut.endTime = 0;
    }
  } else {
    pendingMusicFadeOut.id = null;
  }
  $("#btnStopMeetingMusic i").addClass("fa-circle-notch fa-spin").removeClass("fa-stop").closest("button").prop("title", "...");
  $("#btnMeetingMusic, #btnStopMeetingMusic").toggle();
  var songs = (await getMediaLinks("sjjm", null, null, "MP3")).sort(() => .5 - Math.random());
  var iterator = 0;
  function createAudioElem(iterator) {
    $("body").append($("<audio id='meetingMusic' autoplay>").data("track", songs[iterator].track).on("ended", function() {
      $("#meetingMusic").remove();
      iterator = (iterator < songs.length - 1 ? iterator + 1 : 0);
      createAudioElem(iterator);
    }).on("loadstart", function() {
      $("#btnStopMeetingMusic i").addClass("fa-circle-notch fa-spin").removeClass("fa-stop").closest("button").prop("title", "...");
      displayMusicRemaining();
    }).on("canplay", function() {
      $("#btnStopMeetingMusic i").addClass("fa-stop").removeClass("fa-circle-notch fa-spin").closest("button").prop("title", songs[iterator].title);
      displayMusicRemaining();
    }).on("timeupdate", function() {
      displayMusicRemaining();
    }).append("<source src='"+ songs[iterator].url + "' type='audio/mpeg'>"));
  }
  createAudioElem(iterator);
});
$(".btn-home, #btn-settings").on("click", function() {
  toggleScreen("overlaySettings");
});
$("#btnStopMeetingMusic").on("click", function() {
  clearTimeout(pendingMusicFadeOut.id);
  $("#btnStopMeetingMusic").toggleClass("btn-warning btn-danger").prop("disabled", true);
  $("#meetingMusic").animate({volume: 0}, fadeDelay * 30, () => {
    $("#meetingMusic").remove();
    $("#btnStopMeetingMusic").hide().toggleClass("btn-warning btn-danger").prop("disabled", false);
    $("#musicRemaining").empty();
    if (prefs.enableMusicButton) {
      $("#btnMeetingMusic").show();
    }
  });
});
$("#btnUpload").on("click", async () => {
  try {
    $("#btnUpload").prop("disabled", true).find("i").addClass("fa-circle-notch fa-spin").removeClass("fa-save");
    $("#btnCancelUpload, #chooseMeeting input, .relatedToUploadType input, .relatedToUpload select, .relatedToUpload input").prop("disabled", true);
    if ($("input#typeSong:checked").length > 0) {
      let songFile = new Buffer((await request($("#fileToUpload").val(), {isFile: true})).data);
      let songFileName = sanitizeFilename(getPrefix() + " - " + $("#songPicker option:selected").text() + ".mp4");
      if (currentStep == "additionalMedia") {
        fs.writeFileSync(path.join(paths.media, $("#chooseMeeting input:checked").prop("id"), songFileName), songFile);
      } else {
        await webdavPut(songFile, path.posix.join(prefs.congServerDir, "Media", $("#chooseMeeting input:checked").prop("id")), songFileName);
      }
    } else if ($("input#typeJwpub:checked").length > 0) {
      for (var tempMedia of tempMediaArray) {
        if (tempMedia.url) tempMedia.contents = new Buffer((await request(tempMedia.url, {isFile: true})).data);
        let jwpubFileName = sanitizeFilename(getPrefix() + " - " + tempMedia.filename);
        if (currentStep == "additionalMedia") {
          if (tempMedia.contents) {
            fs.writeFileSync(path.join(paths.media, $("#chooseMeeting input:checked").prop("id"), jwpubFileName), tempMedia.contents);
          } else {
            fs.copyFileSync(tempMedia.localpath, path.join(paths.media, $("#chooseMeeting input:checked").prop("id"), jwpubFileName));
          }
        } else {
          await webdavPut((tempMedia.contents ? tempMedia.contents : fs.readFileSync(tempMedia.localpath)), path.posix.join(prefs.congServerDir, "Media", $("#chooseMeeting input:checked").prop("id")), jwpubFileName);
        }
      }
      tempMediaArray = [];
    } else {
      for (var splitLocalFile of $("#fileToUpload").val().split(" -//- ")) {
        let splitFileToUploadName = sanitizeFilename(getPrefix() + " - " + path.basename(splitLocalFile));
        if (currentStep == "additionalMedia") {
          fs.copyFileSync(splitLocalFile, path.join(paths.media, $("#chooseMeeting input:checked").prop("id"), splitFileToUploadName));
        } else {
          await webdavPut(fs.readFileSync(splitLocalFile), path.posix.join(prefs.congServerDir, "Media", $("#chooseMeeting input:checked").prop("id")), splitFileToUploadName);
        }
      }
    }
  } catch (err) {
    notifyUser("error", "errorAdditionalMedia", $("#fileToUpload").val(), true, err, true);
  }
  await executeDryrun();
  $("#btnUpload").prop("disabled", false).find("i").addClass("fa-save").removeClass("fa-circle-notch fa-spin");
  $("#btnCancelUpload, #chooseMeeting input, .relatedToUploadType input, .relatedToUpload select, .relatedToUpload input").prop("disabled", false);
  $("#chooseMeeting input:checked").change();
});
$("#btn-upload").on("click", async function() {
  $(".relatedToUpload, .relatedToUploadType").fadeTo(fadeDelay, 0);
  $("#btnDoneUpload").fadeOut(fadeDelay);
  $("#btnCancelUpload").fadeIn(fadeDelay);
  currentStep = "uploadFile";
  await executeDryrun(true);
  await toggleScreen("overlayUploadFile");
  overlay(false);
  $("#chooseMeeting").empty();
  for (var meeting of [prefs.mwDay, prefs.weDay, "Recurring"]) {
    let meetingDate = escape((isNaN(meeting) ? meeting : baseDate.add(meeting, "d").format("YYYY-MM-DD")));
    $("#chooseMeeting").append("<input type='radio' class='btn-check' name='chooseMeeting' id='" + meetingDate + "' autocomplete='off'><label class='btn btn-outline-" + (isNaN(meeting) ? "info" : "dark" ) + "' for='" + meetingDate + "'" + (isNaN(meeting) || Object.prototype.hasOwnProperty.call(meetingMedia, meetingDate) ? "" : " style='display: none;'") + ">" + (isNaN(meeting) ? i18n.__("recurring") : meetingDate) + "</label>");
  }
});
$("#chooseUploadType input").on("change", function() {
  $("#songPicker:visible").select2("destroy");
  $("#songPicker, #jwpubPicker, #filePicker").hide();
  $(".enterPrefixInput").val("").empty();
  if ($("#fileToUpload").val()) $("#fileToUpload").val("").change();
  if ($("input#typeSong:checked").length > 0) {
    $(".enterPrefixInput").slice(0, 4).val(0);
    $("#songPicker").val([]).prop("disabled", false).show().select2();
  } else if ($("input#typeFile:checked").length > 0) {
    $("#filePicker").val("").prop("disabled", false).show();
  } else if ($("input#typeJwpub:checked").length > 0) {
    $("#jwpubPicker").val([]).prop("disabled", false).show();
  }
  getPrefix();
});
$(".enterPrefixInput, #congServerPort").on("keypress", function(e){ // cmd/ctrl || arrow keys || delete key || numbers
  return e.metaKey || e.which <= 0 || e.which === 8 || /[0-9]/.test(String.fromCharCode(e.which));
});
$("#overlayUploadFile").on("change", "#filePicker", function() {
  $("#fileToUpload").val($(this).val()).change();
});
$("#overlayUploadFile").on("change", "#jwpubPicker", async function() {
  if ($(this).val().length >0) {
    let contents = await getDbFromJwpub(null, null, $(this).val());
    let tableMultimedia = ((await executeStatement(contents, "SELECT * FROM sqlite_master WHERE type='table' AND name='DocumentMultimedia'")).length === 0 ? "Multimedia" : "DocumentMultimedia");
    let suppressZoomExists = (await executeStatement(contents, "SELECT COUNT(*) AS CNTREC FROM pragma_table_info('Multimedia') WHERE name='SuppressZoom'")).map(function(item) {
      return (item.CNTREC > 0 ? true : false);
    })[0];
    let itemsWithMultimedia = await executeStatement(contents, "SELECT DISTINCT " + tableMultimedia + ".DocumentId, Document.Title FROM Document INNER JOIN " + tableMultimedia + " ON Document.DocumentId = " + tableMultimedia + ".DocumentId " + (tableMultimedia === "DocumentMultimedia" ? "INNER JOIN Multimedia ON Multimedia.MultimediaId = DocumentMultimedia.MultimediaId " : "") + "WHERE (Multimedia.CategoryType <> 9)" + (suppressZoomExists ? " AND Multimedia.SuppressZoom = 0" : "") + " ORDER BY " + tableMultimedia + ".DocumentId");
    if (itemsWithMultimedia.length > 0) {
      var docList = $("<div id='docSelect' class='list-group'>");
      for (var item of itemsWithMultimedia) {
        $(docList).append("<button class='d-flex list-group-item list-group-item-action' data-docid='" + item.DocumentId + "'><div class='flex-fill'> " + item.Title + "</div><div><i class='far fa-circle'></i></div></li>");
      }
      showModal(true, itemsWithMultimedia.length > 0, i18n.__("selectDocument"), docList, itemsWithMultimedia.length === 0, true);
    } else {
      $(this).val("");
      $("#fileToUpload").val("").change();
      notifyUser("warn", "warnNoDocumentsFound", $(this).val(), true, null, true);
    }
  } else {
    $("#fileToUpload").val("").change();
  }
});
$("#staticBackdrop").on("click", "a", function() {
  shell.openExternal($(this).data("href"));
});
$("#staticBackdrop").on("mousedown", "#docSelect button", async function() {
  $("#docSelect button").prop("disabled", true);
  $(this).addClass("active").find("i").toggleClass("far fas fa-circle fa-circle-notch fa-spin");
  tempMediaArray = [];
  var multimediaItems = await getDocumentMultimedia((await getDbFromJwpub(null, null, $("#jwpubPicker").val())), $(this).data("docid"), null, true);
  var missingMedia = $("<div id='missingMedia' class='list-group'>");
  for (var i = 0; i < multimediaItems.length; i++) {
    progressSet(i + 1, multimediaItems.length);
    let multimediaItem = multimediaItems[i];
    var tempMedia = {
      filename: sanitizeFilename((i + 1).toString().padStart(2, "0") + " - " + (multimediaItem.queryInfo.Label ? multimediaItem.queryInfo.Label : (multimediaItem.queryInfo.Caption ? multimediaItem.queryInfo.Caption : (multimediaItem.queryInfo.FilePath ? multimediaItem.queryInfo.FilePath : multimediaItem.queryInfo.KeySymbol + "." + (multimediaItem.queryInfo.MimeType.includes("video") ? "mp4" : "mp3")))) + (multimediaItem.queryInfo.FilePath && (multimediaItem.queryInfo.Label || multimediaItem.queryInfo.Caption) ? path.extname(multimediaItem.queryInfo.FilePath) : ""))
    };
    if (multimediaItem.queryInfo.CategoryType !== -1) {
      var jwpubContents = await new zipper($("#jwpubPicker").val()).readFile("contents");
      tempMedia.contents = (await new zipper(jwpubContents).readFile(((await new zipper(jwpubContents).getEntries()).filter(entry => entry.name == multimediaItem.queryInfo.FilePath)[0]).entryName));
    } else {
      var externalMedia = (await getMediaLinks(multimediaItem.queryInfo.KeySymbol, multimediaItem.queryInfo.Track, multimediaItem.queryInfo.IssueTagNumber, null, multimediaItem.queryInfo.MultiMeps));
      if (externalMedia.length > 0) {
        Object.assign(tempMedia, externalMedia[0]);
        tempMedia.filename = (i + 1).toString().padStart(2, "0") + " - " + path.basename(tempMedia.url);
      } else {
        $(missingMedia).append($("<button class='list-group-item list-group-item-action' data-filename='" + tempMedia.filename + "'>" + tempMedia.filename + "</li>").on("click", function() {
          var missingMediaPath = remote.dialog.showOpenDialogSync({
            title: $(this).data("filename"),
            filters: [
              { name: $(this).data("filename"), extensions: [path.extname($(this).data("filename")).replace(".", "")] }
            ]
          });
          if (typeof missingMediaPath !== "undefined") {
            tempMediaArray.find(item => item.filename == $(this).data("filename")).localpath = missingMediaPath[0];
            $(this).addClass("list-group-item-dark");
          }
          if (tempMediaArray.filter(item => !item.contents && !item.localpath).length === 0) {
            $("#staticBackdrop .modal-footer button").prop("disabled", false);
            $("#fileToUpload").val(tempMediaArray.map(item => item.filename).join(" -//- ")).change();
          }
        }));
      }
    }
    tempMediaArray.push(tempMedia);
  }
  if (tempMediaArray.filter(item => !item.contents && !item.localpath && !item.url).length > 0) {
    showModal(true, true, i18n.__("selectExternalMedia"), missingMedia, true, false);
  } else {
    $("#fileToUpload").val(tempMediaArray.map(item => item.filename).join(" -//- ")).change();
    showModal(false);
  }
});
$("#mediaSync").on("click", async function() {
  $("#mediaSync, #baseDate-dropdown").prop("disabled", true);
  await startMediaSync();
  await overlay(true, "circle-check text-success fa-beat", (prefs.autoQuitWhenDone ? "person-running" : null), "stay-alive");
  await delay(3);
  if (prefs.autoQuitWhenDone && !stayAlive) {
    remote.app.exit();
  } else {
    overlay(false);
    $(".btn-home, #btn-settings" + (prefs.congServer && prefs.congServer.length > 0 ? " #btn-upload" : "")).fadeTo(fadeDelay, 1);
    $("#mediaSync, #baseDate-dropdown").prop("disabled", false);
  }
});
$("#localOutputPath").on("mousedown", function(event) {
  $(this).val(remote.dialog.showOpenDialogSync({ properties: ["openDirectory"] })).change();
  event.preventDefault();
});
$("#overlaySettings").on("click", ".btn-clean-up", function() {
  $(this).toggleClass("btn-success btn-warning").prop("disabled", true);
  setVars();
  rm([paths.media, paths.langs, paths.pubs]);
  $(".alertIndicators i").addClass("far fa-circle").removeClass("fas fa-check-circle");
  setTimeout(() => {
    $(".btn-clean-up").toggleClass("btn-success btn-warning").prop("disabled", false);
  }, 3000);
});
$("#overlayUploadFile").on("change", "#chooseMeeting input", function() {
  removeEventListeners();
  document.addEventListener("drop", dropHandler);
  document.addEventListener("dragover", dragoverHandler);
  document.addEventListener("dragenter", dragenterHandler);
  document.addEventListener("dragleave", dragleaveHandler);
  $("#chooseUploadType input").prop("checked", false).change();
  $("#chooseUploadType label.active").removeClass("active");
  $(".relatedToUploadType").fadeTo(fadeDelay, 1);
});
$("#overlayUploadFile").on("change", "#chooseMeeting input, #chooseUploadType input", function() {
  $(".relatedToUpload").fadeTo(fadeDelay, ($("#chooseMeeting input:checked").length === 0 || $("#chooseUploadType input:checked").length === 0 ? 0 : 1));
});
$("#fileList").on("click", "li:not(.confirmDelete) .fa-minus-square", function() {
  $(this).closest("li").addClass("confirmDelete");
  setTimeout(() => {
    $(".confirmDelete").removeClass("confirmDelete");
  }, 3000);
});
$("#fileList").on("click", "li.confirmDelete:not(.webdavWait) .fa-minus-square", async function() {
  $(this).closest("li").addClass("webdavWait");
  let successful = true;
  if (currentStep == "additionalMedia") {
    rm(path.join(paths.media, $("#chooseMeeting input:checked").prop("id"), $(this).closest("li").data("url")));
  } else {
    successful = await webdavRm($(this).closest("li").data("url"));
  }
  if (successful) {
    $(this).closest("li").slideUp(fadeDelay, function(){
      $(this).tooltip("dispose").remove();
      $("#fileList li").css("width", 100 / Math.ceil($("#fileList li").length / 11) + "%");
    });
    meetingMedia[$("#chooseMeeting input:checked").prop("id")].splice(meetingMedia[$("#chooseMeeting input:checked").prop("id")].findIndex(item => item.media.find(mediaItem => mediaItem.url === $(this).closest("li").data("url"))), 1);
  }
});
$("#fileList").on("click", ".canHide:not(.webdavWait)", async function() {
  $(this).addClass("webdavWait");
  if (await webdavPut(Buffer.from("hide", "utf-8"), path.posix.join(prefs.congServerDir, "Hidden", $("#chooseMeeting input:checked").prop("id")), $(this).data("safename"))) {
    $(this).removeClass("canHide").addClass("wasHidden").find("i.fa-check-square").removeClass("fa-check-square").addClass("fa-square");
    meetingMedia[$("#chooseMeeting input:checked").prop("id")].filter(item => item.media.filter(mediaItem => mediaItem.safeName == $(this).data("safename")).length > 0).forEach(item => item.media.forEach(mediaItem => mediaItem.hidden = true ));
  }
  $(this).removeClass("webdavWait");
});
$("#fileList").on("click", ".canMove:not(.webdavWait) i.fa-pen", async function() {
  let row = $(this).closest(".canMove");
  let src = row.data("url");
  let previousSafename = row.data("safename");
  await showModal(true, false, null, "<div class='input-group'><input type='text' class='form-control' value='" + path.basename(src, path.extname(src)) + "' /><span class='input-group-text'>" + path.extname(src) + "</span></div>", true, true);
  $("#staticBackdrop .modal-body input").focus().on("keypress", function(e) {
    if (e.which == 13) $("#staticBackdrop .modal-footer button").click();
  });
  $("#staticBackdrop .modal-footer button").on("click", async function() {
    let newName = escape($("#staticBackdrop .modal-body input").val().trim()) + path.extname(src);
    if (escape(path.basename(src, path.extname(src))) !== escape($("#staticBackdrop .modal-body input").val().trim())) {
      row.addClass("webdavWait");
      if (await webdavMv(src, path.posix.join(path.dirname(src), newName))) {
        Object.keys(meetingMedia).filter(meeting => dayjs($("#chooseMeeting input:checked").prop("id")).isValid() ? meeting == $("#chooseMeeting input:checked").prop("id") : true).forEach(meeting => {
          meetingMedia[meeting].filter(item => item.media.filter(mediaItem => mediaItem.safeName == previousSafename).length > 0).forEach(item => item.media.forEach(mediaItem => {
            mediaItem.safeName = newName;
            mediaItem.url = path.posix.join(path.dirname(src), newName);
          }));
        });
        row.data("safename", newName).attr("title", newName).data("url", path.posix.join(path.dirname(src), newName)).find("span.filename").text(newName);
        let elems = $("#fileList li").detach().sort(function (a, b) {
          return ($(a).text() < $(b).text() ? -1 : $(a).text() > $(b).text() ? 1 : 0);
        });
        $("#fileList").append(elems);
      }
      row.removeClass("webdavWait");
    }
  });
});
$("#fileList").on("click", ".wasHidden:not(.webdavWait)", async function() {
  $(this).addClass("webdavWait");
  if (await webdavRm(path.posix.join(prefs.congServerDir, "Hidden", $("#chooseMeeting input:checked").prop("id"), $(this).data("safename")))) {
    $(this).removeClass("wasHidden").addClass("canHide").find("i.fa-square").removeClass("fa-square").addClass("fa-check-square");
    meetingMedia[$("#chooseMeeting input:checked").prop("id")].filter(item => item.media.filter(mediaItem => mediaItem.safeName == $(this).data("safename")).length > 0).forEach(item => item.media.forEach(mediaItem => mediaItem.hidden = false ));
  }
  $(this).removeClass("webdavWait");
});
$("#overlayUploadFile").on("change", ".enterPrefixInput, #chooseMeeting input, #fileToUpload", function() {
  let initiatingChange = $(this).prop("name");
  try {
    if ($("#chooseMeeting input:checked").length > 0) {
      $(".relatedToUpload *:not(.enterPrefixInput):enabled").prop("disabled", true).addClass("fileListLoading");
      var weekMedia = {
        existing: [],
        new: []
      };
      if (currentStep == "additionalMedia") {
        fs.readdirSync(path.join(paths.media, $("#chooseMeeting input:checked").prop("id"))).map(function(item) {
          weekMedia.existing.push({
            title: item,
            media: [{
              safeName: item,
              url: item,
              filepath: path.join(paths.media, $("#chooseMeeting input:checked").prop("id"), item)
            }]
          });
        });
      } else {
        if (!meetingMedia[$("#chooseMeeting input:checked").prop("id")]) meetingMedia[$("#chooseMeeting input:checked").prop("id")] = [];
        weekMedia.existing = meetingMedia[$("#chooseMeeting input:checked").prop("id")].filter(mediaItem => mediaItem.media.length > 0);
      }
      var newFiles = [];
      let newFileChosen = $("#fileToUpload").val() !== null && $("#fileToUpload").val() !== undefined && $("#fileToUpload").val().length > 0;
      if (newFileChosen) {
        for (var splitFileToUpload of $("input#typeSong:checked").length > 0 ? [$("#songPicker option:selected").text() + ".mp4"] : $("#fileToUpload").val().split(" -//- ")) {
          newFiles.push({
            title: "New file!",
            media: [{
              safeName: sanitizeFilename(getPrefix() + " - " + path.basename(splitFileToUpload)).trim(),
              newFile: true,
              recurring: false,
              filepath: splitFileToUpload,
              trackImage: ($("input#typeSong:checked").length > 0 && $("#songPicker option:selected").data("thumbnail") ? $("#songPicker option:selected").data("thumbnail") : null)
            }]
          });
        }
        weekMedia.new = newFiles;
      }
      $("#fileList li" + (initiatingChange == "chooseMeeting" ? "" : ".new-file")).slideUp(fadeDelay, function() {
        $(this).remove();
        $(".tooltip").remove();
        $("#btnUpload").toggle(newFileChosen).prop("disabled", $("#fileList .duplicated-file").length > 0);
      });
      let newList = Object.keys(weekMedia).map(type => (initiatingChange == "chooseMeeting" || type == "new") &&  weekMedia[type]).flat().filter(Boolean).map(weekMediaItem => weekMediaItem.media).flat().sort((a, b) => a.safeName.localeCompare(b.safeName));
      for (var file of newList) {
        let html = $("<li data-bs-toggle='tooltip' data-url='" + file.url + "' data-safename='" + file.safeName + "' style='display: none;'><span class='filename w-100'>" + file.safeName + "</span><div class='infoIcons ms-1'></div></li>").tooltip({
          title: file.safeName
        });
        if ((currentStep == "additionalMedia" && !file.newFile) || (file.congSpecific && !file.recurring)) html.addClass("canDelete").prepend("<i class='fas fa-fw fa-minus-square me-2 text-danger'></i>");
        if (currentStep !== "additionalMedia") {
          if (!file.newFile) {
            if (file.congSpecific && !file.recurring) html.addClass("canMove").find(".infoIcons").append("<i class='fas fa-fw fa-pen me-1'></i>");
            if (((!file.congSpecific && (file.url || file.safeName.includes(" - "))) || file.recurring) && !file.hidden) html.addClass("canHide").prepend("<i class='far fa-fw fa-check-square me-2'></i>");
            if (!file.congSpecific && !(file.url || file.safeName.includes(" - "))) html.addClass("cantHide").prepend("<i class='fas fa-fw fa-stop me-2'></i>");
          }
          if (file.hidden) html.addClass("wasHidden").prepend("<i class='far fa-fw fa-square me-2'></i>");
        }
        if (file.newFile) html.addClass("new-file").prepend("<i class='fas fa-fw fa-plus-square me-2'></i>");
        if (Object.values(weekMedia).flat().map(weekMediaItem => weekMediaItem.media).flat().filter(item => item.safeName == file.safeName).length > 1) html.addClass("duplicated-file");
        let fileOrigin = "fa-globe-americas";
        if (file.congSpecific || file.newFile) {
          fileOrigin = "fa-cloud";
          if (file.recurring) html.find(".infoIcons").append("<i class='fas fa-fw fa-sync-alt me-1'></i>");
        }
        let fileType = "fa-question-circle";
        if (isImage(file.safeName)) {
          fileType = "fa-image";
        } else if (isVideo(file.safeName)) {
          fileType = "fa-play-circle";
        } else if (path.extname(file.safeName).toLowerCase() == ".pdf") {
          fileType = "fa-file-pdf";
        }
        html.find(".infoIcons").append("<i class='far fa-fw " + fileType + " file-type me-1'></i>" + (currentStep !== "additionalMedia" ? "<i class='fas fa-fw " + fileOrigin + " file-origin me-1'></i>" : ""));
        if (file.trackImage || file.congSpecific || file.filepath) {
          let imageSrc = {};
          if (file.trackImage) {
            imageSrc.path = file.trackImage;
          } else if (file.filepath) {
            imageSrc.path = file.filepath;
            if (tempMediaArray.find(item => item.filename == file.filepath)) imageSrc.data = tempMediaArray.find(item => item.filename == file.filepath).contents;
          } else if (currentStep === "additionalMedia") {
            imageSrc.path = path.join(paths.media, $("#chooseMeeting input:checked").prop("id"), file.url);
          } else {
            imageSrc.path = file.url;
          }
          if (isImage(imageSrc.path)) {
            if (file.congSpecific) {
              request("https://" + prefs.congServer + ":" + prefs.congServerPort + file.url, {
                webdav: true,
                isFile: true
              }).then(res => {
                if (res.data) {
                  html.tooltip("dispose").tooltip({
                    html: true,
                    title: $("<img />", {
                      style: "max-height: 100%; max-width: 100%; min-width: 180px;",
                      src: "data:;base64," + Buffer.from(res.data, "binary").toString("base64")
                    })
                  });
                }
              });
            } else {
              html.tooltip("dispose").tooltip({
                html: true,
                title: $("<img />", {
                  style: "max-height: 100%; max-width: 100%; min-width: 180px;",
                  src: (imageSrc.data ? "data:;base64," + Buffer.from(imageSrc.data, "binary").toString("base64") : imageSrc.path)
                })
              });
            }
          }
        }
        let insertPosition = $("#fileList li").toArray().concat(html).sort((a, b) => $(a).text().localeCompare($(b).text())).indexOf(html);
        if (initiatingChange == "chooseMeeting" || insertPosition >= $("#fileList li").length) {
          html.appendTo($("#fileList")).slideDown(fadeDelay);
        } else {
          if (insertPosition < $("#fileList li").length) {
            html.insertBefore($("#fileList li").eq($("#fileList li").toArray().concat(html).sort((a, b) => $(a).text().localeCompare($(b).text())).indexOf(html))).slideDown(fadeDelay);
          }
        }
      }
      $("#fileList li").css("width", 100 / Math.ceil(Object.values(weekMedia).flat().map(item => item.media).flat().length / 11) + "%");
      $("#btnUpload").toggle(newFileChosen).prop("disabled", $("#fileList .duplicated-file").length > 0);
      $("#" + (currentStep == "additionalMedia" ? "btnDoneUpload" : "btnCancelUpload")).toggle(!newFileChosen);
      $(".fileListLoading").prop("disabled", false).removeClass("fileListLoading");
    }
  } catch (err) {
    notifyUser("error", "errorAdditionalMediaList", null, true, err, true);
  }
});
$("#overlayUploadFile").on("keyup", ".enterPrefixInput", getPrefix);
$("#overlayUploadFile").on("mousedown", "input#filePicker, input#jwpubPicker", function(event) {
  let thisId = $(this).prop("id");
  let options = {
    properties: ["multiSelections", "openFile"]
  };
  if (thisId.includes("jwpub")) options = {
    filters: [
      { name: "JWPUB", extensions: ["jwpub"] }
    ]
  };
  let path = remote.dialog.showOpenDialogSync(options);
  $(this).val((typeof path !== "undefined" ? (thisId.includes("file") ? path.join(" -//- ") : path) : "")).change();
  event.preventDefault();
});
$("#songPicker").on("change", function() {
  if ($(this).val()) $("#fileToUpload").val($(this).val()).change();
});
$(document).on("shown.bs.modal", "#staticBackdrop", function () {
  if ($("#staticBackdrop input").length > 0) {
    let inputVal = $("#staticBackdrop input").first().val();
    $("#staticBackdrop input")[0].focus();
    $("#staticBackdrop input").first().val("").val(inputVal);
  }
});
$("#overlaySettings").on("click", ".btn-action:not(.btn-danger)", function() {
  if ($(this).hasClass("btn-report-issue")) $(this).data("action-url", bugUrl());
  shell.openExternal($(this).data("action-url"));
});
$("#btnTestApp").on("click", testJwmmf);
$("#toastContainer").on("click", "button.toast-action", function() {
  if ($(this).data("toast-action-url")) shell.openExternal($(this).data("toast-action-url"));
  $(this).closest(".toast").find(".toast-header button.btn-close").click();
});
$("#webdavProviders a").on("click", function() {
  for (let i of Object.entries($(this).data())) {
    let name = "cong" + (i[0][0].toUpperCase() + i[0].slice(1));
    prefs[name] = i[1];
    $("#" + name).val(i[1]);
  }
  $("#congServer").change();
});
