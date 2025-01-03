// data reported to main thread
// import LogManager from '../../../utils/LogManager';
// import { SentryLogLevel } from '../../../constants';

// -1=not started, 0=starting, 1=download test, 2=ping+jitter test, 3=upload test, 4=finished, 5=abort
let testState = -1;
// download speed in megabit/s with 2 decimal digits
let dlStatus = 0;
// upload speed in megabit/s with 2 decimal digits
let ulStatus = '';
// ping in milliseconds with 2 decimal digits
let pingStatus = '';
// jitter in milliseconds with 2 decimal digits
let jitterStatus = '';
// client's IP address as reported by getIP.php
let clientIp = '';
let serverHostName = '';
//progress of download test 0-1
let dlProgress = 0;
//progress of upload test 0-1
let ulProgress = 0;
//progress of ping+jitter test 0-1
let pingProgress = 0;
//test ID (sent back by telemetry if used, null otherwise)
let testId = null;

let log = ''; //telemetry log

function tlog(s) {
  if (settings.telemetry_level >= 2) {
    log += Date.now() + ': ' + s + '\n';
  }
}

function tverb(s) {
  if (settings.telemetry_level >= 3) {
    log += Date.now() + ': ' + s + '\n';
  }
}

function twarn(s) {
  if (settings.telemetry_level >= 2) {
    log += Date.now() + ' WARN: ' + s + '\n';
  }

  // LogManager.message(s, SentryLogLevel.WARNING);
  console.warn(s);
}

// test settings. can be overridden by sending specific values with the start command
const settings = {
  //set to true when in MPOT mode
  mpot: false,
  //order in which tests will be performed as a string. D=Download, U=Upload, P=Ping+Jitter, I=IP, _=1 second delay
  test_order: 'P_D',
  // max duration of upload test in seconds
  time_ul_max: 0,
  // max duration of download test in seconds
  time_dl_max: 15,
  // if set to true, tests will take less time on faster connections
  time_auto: true,
  //time to wait in seconds before actually measuring ul speed (wait for buffers to fill)
  time_ulGraceTime: 3,
  //time to wait in seconds before actually measuring dl speed (wait for TCP window to increase)
  time_dlGraceTime: 1.5,
  // number of pings to perform in ping test
  count_ping: 10,
  // path to a large file or garbage.php, used for download test. must be relative to this js file
  url_dl: 'backend/garbage.php',
  // path to an empty file, used for upload test. must be relative to this js file
  url_ul: 'backend/empty.php',
  // path to an empty file, used for ping test. must be relative to this js file
  url_ping: 'backend/empty.php',
  // path to getIP.php relative to this js file, or a similar thing that outputs the client's ip
  url_getIp: 'backend/getIP.php',
  // if set to true, the server will include ISP info with the IP address
  getIp_ispInfo: true,
  // km or mi=estimate distance from server in km/mi; set to false to disable distance estimation.
  // getIp_ispInfo must be enabled in order for this to work
  getIp_ispInfo_distance: false,
  // number of download streams to use (can be different if enable_quirks is active)
  xhr_dlMultistream: 6,
  // number of upload streams to use (can be different if enable_quirks is active)
  xhr_ulMultistream: 3,
  // how much concurrent requests should be delayed
  xhr_multistreamDelay: 300,
  // 0=fail on errors, 1=attempt to restart a stream if it fails, 2=ignore all errors
  xhr_ignoreErrors: 1,
  // if set to true, it reduces ram usage but uses the hard drive (useful with large garbagePhp_chunkSize
  // and/or high xhr_dlMultistream)
  xhr_dlUseBlob: false,
  // size in megabytes of the upload blobs sent in the upload test (forced to 4 on chrome mobile)
  xhr_ul_blob_megabytes: 20,
  // size of chunks sent by garbage.php (can be different if enable_quirks is active)
  garbagePhp_chunkSize: 100,
  // enable quirks for specific browsers. currently it overrides settings to optimize for specific browsers,
  // unless they are already being overridden with the start command
  enable_quirks: true,
  // if enabled, the ping test will attempt to calculate the ping more precisely using the Performance API.
  // Currently works perfectly in Chrome, badly in Edge, and not at all in Firefox.
  // If Performance API is not supported or the result is obviously wrong, a fallback is provided.
  ping_allowPerformanceApi: true,
  // can be changed to compensatie for transport overhead. (see doc.md for some other values)
  overheadCompensationFactor: 1.06,
  //if set to true, speed will be reported in mebibits/s instead of megabits/s
  useMebibits: false,
  // 0=disabled, 1=basic (results only), 2=full (results and timing) 3=debug (results+log)
  telemetry_level: 0,
  // path to the script that adds telemetry data to the database
  url_telemetry: 'results/telemetry.php',
  //extra data that can be passed to the telemetry through the settings
  telemetry_extra: ''
};

let xhr = null; // array of currently active xhr requests
let interval = null; // timer used in tests
let test_pointer = 0; //pointer to the next test to run inside settings.test_order

/*
  this function is used on URLs passed in the settings to determine whether we need a ? or an & as a separator
*/
function url_sep(url) {
  return url.match(/\?/) ? '&' : '?';
}

/*
    listener for commands from main thread to this worker.
    commands:
    -status: returns the current status as a JSON string containing testState,
      dlStatus, ulStatus, pingStatus, clientIp, jitterStatus, dlProgress, ulProgress, pingProgress
    -abort: aborts the current test
    -start: starts the test. optionally, settings can be passed as JSON.
        example: start {"time_ul_max":"10", "time_dl_max":"10", "count_ping":"50"}
*/
self.addEventListener('message', function (e) {
  const params = e.data.split(' ');

  if (params[0] === 'status') {
    // return status
    postMessage(
      {
        testState: testState,
        dlStatus: dlStatus,
        ulStatus: ulStatus,
        pingStatus: pingStatus,
        clientIp: clientIp,
        serverHostName: serverHostName,
        jitterStatus: jitterStatus,
        dlProgress: dlProgress,
        ulProgress: ulProgress,
        pingProgress: pingProgress,
        testId: testId
      }
    );
  }
  if (params[0] === 'start' && testState === -1) {
    const ua = navigator.userAgent;

    // start new test
    testState = 0;
    try {
      // parse settings, if present
      let s = {};

      try {
        const ss = e.data.substring(5);

        if (ss) {
          s = JSON.parse(ss);
        }
      } catch (e) {
        twarn('Error parsing custom settings JSON. Please check your syntax');
      }
      //copy custom settings
      for (const key in s) {
        if (typeof settings[key] !== 'undefined') {
          settings[key] = s[key];
        } else {
          twarn('Unknown setting ignored: ' + key);
        }
      }
      // quirks for specific browsers. apply only if not overridden. more may be added in future releases
      if (settings.enable_quirks || (typeof s.enable_quirks !== 'undefined' && s.enable_quirks)) {
        if (/Firefox.(\d+\.\d+)/i.test(ua)) {
          if (typeof s.ping_allowPerformanceApi === 'undefined') {
            // ff performance API sucks
            settings.ping_allowPerformanceApi = false;
          }
        }
        if (/Edge.(\d+\.\d+)/i.test(ua)) {
          if (typeof s.xhr_dlMultistream === 'undefined') {
            // edge more precise with 3 download streams
            settings.xhr_dlMultistream = 3;
          }
        }
        if (/Chrome.(\d+)/i.test(ua) && !!self.fetch) {
          if (typeof s.xhr_dlMultistream === 'undefined') {
            // chrome more precise with 5 streams
            settings.xhr_dlMultistream = 5;
          }
        }
      }
      if (/Edge.(\d+\.\d+)/i.test(ua)) {
        //Edge 15 introduced a bug that causes onprogress events to not get fired,
        // we have to use the "small chunks" workaround that reduces accuracy
        settings.forceIE11Workaround = true;
      }
      if (/PlayStation 4.(\d+\.\d+)/i.test(ua)) {
        //PS4 browser has the same bug as IE11/Edge
        settings.forceIE11Workaround = true;
      }
      if (/Chrome.(\d+)/i.test(ua) && /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)) {
        // cheap af
        // Chrome mobile introduced a limitation somewhere around version 65,
        // we have to limit XHR upload size to 4 megabytes
        settings.xhr_ul_blob_megabytes = 4;
      }
      if (/^((?!chrome|android|crios|fxios).)*safari/i.test(ua)) {
        //Safari also needs the IE11 workaround but only for the MPOT version
        settings.forceIE11Workaround = true;
      }
      // telemetry_level has to be parsed and not just copied
      if (typeof s.telemetry_level !== 'undefined') {
        const telemetryLevels = {
          'basic': 1,
          'full': 2,
          'debug': 3
        };

        settings.telemetry_level = telemetryLevels[s.telemetry_level] || 0;
      } // telemetry level
      // transform test_order to uppercase, just in case
      settings.test_order = settings.test_order.toUpperCase();
    } catch (e) {
      twarn('Possible error in custom test settings. Some settings might not have been applied. Exception: ' + e);
    }
    // run the tests
    tverb(JSON.stringify(settings));
    test_pointer = 0;
    let iRun = false,
      dRun = false,
      // uRun = false,
      pRun = false;
    // eslint-disable-next-line no-var
    var runNextTest = function () {
      if (testState === 5) {
        return;
      }
      if (test_pointer >= settings.test_order.length) {
        //test is finished
        if (settings.telemetry_level > 0) {
          sendTelemetry(function (id) {
            testState = 4;
            if (id !== null || id !== undefined) {
              testId = id;
            }
          });
        } else {
          testState = 4;
        }

        return;
      }
      switch (settings.test_order.charAt(test_pointer)) {
        case 'I': {
          test_pointer++;
          if (iRun) {
            runNextTest();

            return;
          } else {
            iRun = true;
          }
          getIp(runNextTest);
        }
          break;
        case 'D': {
          test_pointer++;
          if (dRun) {
            runNextTest();

            return;
          } else {
            dRun = true;
          }
          testState = 1;
          dlTest(runNextTest);
        }
          break;
        case 'U': {
        // test_pointer++;
        // if (uRun) {
        //     runNextTest();
        //     return;
        // } else uRun = true;
        // testState = 3;
        // ulTest(runNextTest);
        }
          break;
        case 'P': {
          test_pointer++;
          if (pRun) {
            runNextTest();

            return;
          } else {
            pRun = true;
          }
          testState = 2;
          pingTest(runNextTest);
        }
          break;
        case '_': {
          test_pointer++;
          setTimeout(runNextTest, 1000);
        }
          break;
        default:
          test_pointer++;
      }
    };

    runNextTest();
  }
  if (params[0] === 'abort') {
    // abort command
    if (testState >= 4) {
      return;
    }
    tlog('manually aborted');
    clearRequests(); // stop all xhr activity
    runNextTest = null;
    if (interval) {
      clearInterval(interval);
    } // clear timer if present
    if (settings.telemetry_level > 1) {
      sendTelemetry(function () {
      });
    }
    testState = 5; //set test as aborted
    dlStatus = 0;
    ulStatus = '';
    pingStatus = '';
    jitterStatus = '';
    clientIp = '';
    serverHostName = '';
    dlProgress = 0;
    ulProgress = 0;
    pingProgress = 0;
  }
});

// stops all XHR activity, aggressively
function clearRequests() {
  tverb('stopping pending XHRs');
  if (xhr) {
    for (let i = 0; i < xhr.length; i++) {
      try {
        xhr[i].onprogress = null;
        xhr[i].onload = null;
        xhr[i].onerror = null;
      } catch (e) {
        console.warn(e);
      }
      try {
        xhr[i].upload.onprogress = null;
        xhr[i].upload.onload = null;
        xhr[i].upload.onerror = null;
      } catch (e) {
        console.warn(e);
      }
      try {
        xhr[i].abort();
      } catch (e) {
        console.warn(e);
      }
      try {
        delete xhr[i];
      } catch (e) {
        console.warn(e);
      }
    }
    xhr = null;
  }
}

// gets client's IP using url_getIp, then calls the done function
let ipCalled = false; // used to prevent multiple accidental calls to getIp
let ispInfo = ''; //used for telemetry

function getIp(done) {
  tverb('getIp');
  if (ipCalled) {
    return;
  } else {
    ipCalled = true;
  } // getIp already called?
  const startT = new Date().getTime();

  xhr = new XMLHttpRequest();
  xhr.onload = function () {
    tlog('IP: ' + xhr.responseText + ', took ' + (new Date().getTime() - startT) + 'ms');
    try {
      const data = JSON.parse(xhr.responseText);

      clientIp = data.processedString;
      serverHostName = data.serverHostName;
      ispInfo = data.rawIspInfo;
    } catch (e) {
      clientIp = xhr.responseText;
      ispInfo = '';
    }
    done();
  };
  xhr.onerror = function () {
    tlog('getIp failed, took ' + (new Date().getTime() - startT) + 'ms');
    done();
  };
  const queryParams = [
    settings.mpot ? 'cors=true' : '',
    settings.getIp_ispInfo ?
      `isp=true${settings.getIp_ispInfo_distance ? '&distance=' + settings.getIp_ispInfo_distance : ''}` :
      '',
    'r=' + Math.random()
  ].filter(Boolean).join('&');

  const url = `${settings.url_getIp}${url_sep(settings.url_getIp)}${queryParams}`;

  xhr.open(
    'GET',
    url,
    true
  );
  xhr.send();
}

// download test, calls done function when it's over
let dlCalled = false; // used to prevent multiple accidental calls to dlTest

function dlTest(done) {
  tverb('dlTest');
  if (dlCalled) {
    return;
  } else {
    dlCalled = true;
  } // dlTest already called?
  let totLoaded = 0.0, // total number of loaded bytes
    startT = new Date().getTime(), // timestamp when test was started
    bonusT = 0, //how many milliseconds the test has been shortened by (higher on faster connections)
    graceTimeDone = false, //set to true after the grace time is past
    failed = false; // set to true if a stream fails

  xhr = [];
  // function to create a download stream. streams are slightly delayed so that they will not end at the same time
  const testStream = function (i, delay) {
    setTimeout(
      function () {
        if (testState !== 1) {
          return;
        } // delayed stream ended up starting after the end of the download test
        tverb('dl test stream started ' + i + ' ' + delay);
        let prevLoaded = 0; // number of bytes loaded last time onprogress was called
        const x = new XMLHttpRequest();

        xhr[i] = x;
        xhr[i].onprogress = function (event) {
          tverb('dl stream progress event ' + i + ' ' + event.loaded);
          if (testState !== 1) {
            try {
              x.abort();
            } catch (e) {
              console.warn(e);
            }
          } // just in case this XHR is still running after the download test
          // progress event, add number of new loaded bytes to totLoaded
          const loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;

          if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) {
            return;
          } // just in case
          totLoaded += loadDiff;
          prevLoaded = event.loaded;
        }.bind(this);
        xhr[i].onload = function () {
          // the large file has been loaded entirely, start again
          tverb('dl stream finished ' + i);
          try {
            xhr[i].abort();
          } catch (e) {
            console.warn(e);
          } // reset the stream data to empty ram
          testStream(i, 0);
        }.bind(this);
        xhr[i].onerror = function () {
          // error
          tverb('dl stream failed ' + i);
          if (settings.xhr_ignoreErrors === 0) {
            failed = true;
          } //abort
          try {
            xhr[i].abort();
          } catch (e) {
            console.warn(e);
          }
          delete xhr[i];
          if (settings.xhr_ignoreErrors === 1) {
            testStream(i, 0);
          } //restart stream
        }.bind(this);
        // send xhr
        try {
          if (settings.xhr_dlUseBlob) {
            xhr[i].responseType = 'blob';
          } else {
            xhr[i].responseType = 'arraybuffer';
          }
        } catch (e) {
          console.warn(e);
        }

        const queryParams = [
          settings.mpot ? 'cors=true' : '',
          'r=' + Math.random(),
          'ckSize=' + settings.garbagePhp_chunkSize
        ].join('&');

        const url = `${settings.url_dl}${url_sep(settings.url_dl)}${queryParams}`;

        // random string to prevent caching
        xhr[i].open('GET', url, true);
        xhr[i].send();
      }.bind(this),
      1 + delay
    );
  }.bind(this);

  // open streams
  for (let i = 0; i < settings.xhr_dlMultistream; i++) {
    testStream(i, settings.xhr_multistreamDelay * i);
  }
  // every 200ms, update dlStatus
  interval = setInterval(
    function () {
      tverb('DL: ' + dlStatus + (graceTimeDone ? '' : ' (in grace time)'));
      const t = new Date().getTime() - startT;

      if (graceTimeDone) {
        dlProgress = (t + bonusT) / (settings.time_dl_max * 1000);
      }
      if (t < 200) {
        return;
      }
      if (!graceTimeDone) {
        if (t > 1000 * settings.time_dlGraceTime) {
          if (totLoaded > 0) {
            // if the connection is so slow that we didn't get a single chunk yet, do not reset
            startT = new Date().getTime();
            bonusT = 0;
            totLoaded = 0.0;
          }
          graceTimeDone = true;
        }
      } else {
        const speed = totLoaded / (t / 1000.0);

        if (settings.time_auto) {
          //decide how much to shorten the test. Every 200ms, the test is shortened by the bonusT calculated here
          const bonus = (6.4 * speed) / 100000;

          bonusT += bonus > 800 ? 800 : bonus;
        }
        // update status
        // speed is multiplied by 8 to go from bytes to bits, overhead compensation is applied,
        // then everything is divided by 1048576 or 1000000 to go to megabits/mebibits
        dlStatus = ((speed * 8 * settings.overheadCompensationFactor) / (settings.useMebibits ? 1048576 : 1000000));
        if ((t + bonusT) / 1000.0 > settings.time_dl_max || failed) {
          // test is over, stop streams and timer
          if (failed || isNaN(dlStatus)) {
            dlStatus = 'Fail';
          }
          clearRequests();
          clearInterval(interval);
          dlProgress = 1;
          tlog('dlTest: ' + dlStatus + ', took ' + (new Date().getTime() - startT) + 'ms');
          done();
        }
      }
    }.bind(this),
    200
  );
}

// ping+jitter test, function done is called when it's over
let ptCalled = false; // used to prevent multiple accidental calls to pingTest

function pingTest(done) {
  tverb('pingTest');
  if (ptCalled) {
    return;
  } else {
    ptCalled = true;
  } // pingTest already called?
  const startT = new Date().getTime(); //when the test was started
  let prevT = null; // last time a pong was received
  let ping = 0.0; // current ping value
  let jitter = 0.0; // current jitter value
  let i = 0; // counter of pongs received
  let prevInstspd = 0; // last ping time, used for jitter calculation

  xhr = [];
  // ping function
  const doPing = function () {
    tverb('ping');
    pingProgress = i / settings.count_ping;
    prevT = new Date().getTime();
    xhr[0] = new XMLHttpRequest();
    xhr[0].onload = function () {
      // pong
      tverb('pong');
      if (i === 0) {
        prevT = new Date().getTime(); // first pong
      } else {
        let instspd = new Date().getTime() - prevT;

        if (settings.ping_allowPerformanceApi) {
          try {
            //try to get accurate performance timing using performance api
            let p = performance.getEntries();

            p = p[p.length - 1];
            let d = p.responseStart - p.requestStart;

            if (d <= 0) {
              d = p.duration;
            }
            if (d > 0 && d < instspd) {
              instspd = d;
            }
          } catch (e) {
            //if not possible, keep the estimate
            tverb('Performance API not supported, using estimate');
          }
        }
        //noticed that some browsers randomly have 0ms ping
        if (instspd < 1) {
          instspd = prevInstspd;
        }
        if (instspd < 1) {
          instspd = 1;
        }
        const instjitter = Math.abs(instspd - prevInstspd);

        if (i === 1) {
          ping = instspd;
        }/* first ping, can't tell jitter yet*/ else {
          if (instspd < ping) {
            ping = instspd;
          } // update ping, if the instant ping is lower
          if (i === 2) {
            jitter = instjitter;
          } else {
            //discard the first jitter measurement because it might be much higher than it should be
            jitter = instjitter > jitter ? jitter * 0.3 + instjitter * 0.7 : jitter * 0.8 + instjitter * 0.2;
          } // update jitter, weighted average. spikes in ping values are given more weight.
        }
        prevInstspd = instspd;
      }
      pingStatus = ping.toFixed(2);
      jitterStatus = jitter.toFixed(2);
      i++;
      tverb('ping: ' + pingStatus + ' jitter: ' + jitterStatus);
      if (i < settings.count_ping) {
        doPing();
      } else {
        // more pings to do?
        pingProgress = 1;
        tlog('ping: ' + pingStatus + ' jitter: ' + jitterStatus + ', took ' + (new Date().getTime() - startT) + 'ms');
        done();
      }
    }.bind(this);
    xhr[0].onerror = function () {
      // a ping failed, cancel test
      tverb('ping failed');
      if (settings.xhr_ignoreErrors === 0) {
        //abort
        pingStatus = 'Fail';
        jitterStatus = 'Fail';
        clearRequests();
        tlog('ping test failed, took ' + (new Date().getTime() - startT) + 'ms');
        pingProgress = 1;
        done();
      }
      if (settings.xhr_ignoreErrors === 1) {
        doPing();
      } //retry ping
      if (settings.xhr_ignoreErrors === 2) {
        //ignore failed ping
        i++;
        if (i < settings.count_ping) {
          doPing();
        } else {
          // more pings to do?
          pingProgress = 1;
          tlog('ping: ' + pingStatus + ' jitter: ' + jitterStatus + ', took ' + (new Date().getTime() - startT) + 'ms');
          done();
        }
      }
    }.bind(this);
    // send xhr
    const queryString = [
      settings.mpot ? 'cors=true' : '',
      `r=${Math.random()}`
    ].filter(part => part !== '').join('&');

    const url = `${settings.url_ping}${url_sep(settings.url_ping)}${queryString}`;

    // random string to prevent caching
    xhr[0].open('GET', url, true);
    xhr[0].send();
  }.bind(this);

  doPing(); // start first ping
}

// telemetry
function sendTelemetry(done) {
  if (settings.telemetry_level < 1) {
    return;
  }
  xhr = new XMLHttpRequest();
  xhr.onload = function () {
    try {
      const parts = xhr.responseText.split(' ');

      if (parts[0] === 'id') {
        try {
          const id = parts[1];

          done(id);
        } catch (e) {
          done(null);
        }
      } else {
        done(null);
      }
    } catch (e) {
      done(null);
    }
  };
  xhr.onerror = function () {
    console.warn('TELEMETRY ERROR ' + xhr.status);
    done(null);
  };
  xhr.open('POST', settings.url_telemetry + url_sep(settings.url_telemetry) + (settings.mpot ? 'cors=true&' : '') + 'r=' + Math.random(), true);
  const telemetryIspInfo = {
    processedString: clientIp,
    serverHostName: serverHostName,
    rawIspInfo: typeof ispInfo === 'object' ? ispInfo : ''
  };

  try {
    const fd = new FormData();

    fd.append('ispinfo', JSON.stringify(telemetryIspInfo));
    fd.append('dl', dlStatus);
    fd.append('ul', ulStatus);
    fd.append('ping', pingStatus);
    fd.append('jitter', jitterStatus);
    fd.append('log', settings.telemetry_level > 1 ? log : '');
    fd.append('extra', settings.telemetry_extra);
    xhr.send(fd);
  } catch (ex) {
    const postData = 'extra=' + encodeURIComponent(settings.telemetry_extra) + '&ispinfo=' + encodeURIComponent(JSON.stringify(telemetryIspInfo)) + '&dl=' + encodeURIComponent(dlStatus) + '&ul=' + encodeURIComponent(ulStatus) + '&ping=' + encodeURIComponent(pingStatus) + '&jitter=' + encodeURIComponent(jitterStatus) + '&log=' + encodeURIComponent(settings.telemetry_level > 1 ? log : '');

    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send(postData);
  }
}
