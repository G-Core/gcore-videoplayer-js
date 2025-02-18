import { reportError } from '@gcorevideo/utils';

import SpeedtestWorkerModule from '../../../../assets/clappr-nerd-stats/speedtest/speedtest.worker.js';

import { TimerId } from '../../../utils/types.js';

export type Server = {
  id: number;
  country: string;
  name: string;
  server: string;
  dlURL: string;
  ulURL: string;
  pingT: number;
  pingURL: string;
  getIpURL: string;
}

type PerformanceCallback = (t: number) => void;

type EndHandler = (success: boolean) => void;

export type TestStatusInfo = {
  testState: -1 | 0 | 1 | 2 | 3 | 4 | 5;
  dlStatus: number | 'Fail'; // Mbps/Mibps
  ulStatus: number;
  pingStatus: string;
  clientIp: string;
  serverHostName: string;
  jitterStatus: string;
  dlProgress: 0 | 1;
  ulProgress: 0 | 1;
  pingProgress: 0 | 1;
  testId: string | null;
};

type UpdateHandler = (data: TestStatusInfo) => void;

type SelectCallback = (server: Server | null) => void;

// const T = 'plugins.clappr_nerd_stats.speedtest.Speedtest';

export class Speedtest {
  private worker: Worker | null = null;

  private workerUrl: string | null = null;

  private _selectServerCalled = false;

  private _selectedServer: Server | null = null;

  private _serverList: Server[] = [];

  private _settings: any = {};

  private _state = 0;

  private updater: TimerId | null = null;

  private _prevData: TestStatusInfo | null = null;

  private _originalExtra: any; // TODO

  onend: EndHandler | null = null;

  onupdate: UpdateHandler | null = null;

  getState() {
    return this._state;
  }

  setParameter(parameter: string, value: unknown) {
    if (this._state !== 0) {
      throw new Error('You cannot change the test settings after adding server or starting the test');
    }
    this._settings[parameter] = value;
    if (parameter === 'temeletry_extra') {
      this._originalExtra = this._settings.telemetry_extra;
    }
  }

  _checkServerDefinition(server: Server) {
    try {
      if (typeof server.name !== 'string') {
        throw 'Name string missing from server definition (name)';
      }
      if (typeof server.server !== 'string') {
        throw 'Server address string missing from server definition (server)';
      }
      if (server.server.charAt(server.server.length - 1) !== '/') {
        server.server += '/';
      }
      if (server.server.indexOf('//') === 0) {
        server.server = location.protocol + server.server;
      }
      if (typeof server.dlURL !== 'string') {
        throw 'Download URL string missing from server definition (dlURL)';
      }
      if (typeof server.ulURL !== 'string') {
        throw 'Upload URL string missing from server definition (ulURL)';
      }
      if (typeof server.pingURL !== 'string') {
        throw 'Ping URL string missing from server definition (pingURL)';
      }
      if (typeof server.getIpURL !== 'string') {
        throw 'GetIP URL string missing from server definition (getIpURL)';
      }
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
      throw 'Invalid server definition';
    }
  }

  addTestPoint(server: Server) {
    this._checkServerDefinition(server);
    if (this._state === 0) {
      this._state = 1;
    }
    if (this._state !== 1) {
      throw 'You can\'t add a server after server selection';
    }
    this._settings.mpot = true;
    this._serverList.push(server);
  }

  addTestPoints(list: Server[]) {
    for (const server of list) {
      this.addTestPoint(server);
    }
  }

  getSelectedServer() {
    if (this._state < 2 || this._selectedServer === null) {
      throw 'No server is selected';
    }

    return this._selectedServer;
  }

  setSelectedServer(server: Server) {
    this._checkServerDefinition(server);
    if (this._state === 3) {
      throw 'You can\'t select a server while the test is running';
    }
    this._selectedServer = server;
    this._state = 2;
  }

  selectServer(result: SelectCallback) {
    if (this._state !== 1) {
      if (this._state === 0) {
        throw 'No test points added';
      }
      if (this._state === 2) {
        throw 'Server already selected';
      }
      if (this._state >= 3) {
        throw 'You can\'t select a server while the test is running';
      }
    }
    if (this._selectServerCalled) {
      throw 'selectServer already called';
    } else {
      this._selectServerCalled = true;
    }
    /*this function goes through a list of servers. For each server, the ping is measured, then the server with the function result is called with the best server, or null if all the servers were down.
         */
    const select = (serverList: Server[], result: SelectCallback) => {
      //pings the specified URL, then calls the function result. Result will receive a parameter which is either the time it took to ping the URL, or -1 if something went wrong.
      const PING_TIMEOUT = 2000;
      let USE_PING_TIMEOUT = true; //will be disabled on unsupported browsers

      if (/MSIE.(\d+\.\d+)/i.test(navigator.userAgent)) {
        //IE11 doesn't support XHR timeout
        USE_PING_TIMEOUT = false;
      }
      const ping = function (url: string, result: PerformanceCallback) {
        url += (url.match(/\?/) ? '&' : '?') + 'cors=true';
        const xhr = new XMLHttpRequest();
        const t = new Date().getTime();

        xhr.onload = function () {
          if (xhr.responseText.length === 0) {
            //we expect an empty response
            let instspd = new Date().getTime() - t; //rough timing estimate

            try {
              //try to get more accurate timing using performance API
              const pl: PerformanceEntryList = performance.getEntriesByName(url);

              const pe: PerformanceResourceTiming = pl[pl.length - 1] as PerformanceResourceTiming;
              let d = pe.responseStart - pe.requestStart;

              if (d <= 0) {
                d = pe.duration;
              }
              if (d > 0 && d < instspd) {
                instspd = d;
              }
            } catch (error) {
              // LogManager.exception(error);
              reportError(error);
            }
            result(instspd);
          } else {
            result(-1);
          }
        };
        xhr.onerror = function () {
          result(-1);
        };
        xhr.open('GET', url);
        if (USE_PING_TIMEOUT) {
          try {
            xhr.timeout = PING_TIMEOUT;
            xhr.ontimeout = xhr.onerror;
          } catch (error) {
            // LogManager.exception(error);
            reportError(error);
          }
        }
        xhr.send();
      };

      //this function repeatedly pings a server to get a good estimate of the ping. When it's done, it calls the done function without parameters. At the end of the execution, the server will have a new parameter called pingT, which is either the best ping we got from the server or -1 if something went wrong.
      const PINGS = 3, //up to 3 pings are performed, unless the server is down...
        SLOW_THRESHOLD = 500; //...or one of the pings is above this threshold
      const checkServer = function (server: Server, done: () => void) {
        let i = 0;

        server.pingT = -1;
        if (server.server.indexOf(location.protocol) === -1) {
          done();
        } else {
          const nextPing = function () {
            if (i++ === PINGS) {
              done();

              return;
            }
            ping(
              server.server + server.pingURL,
              function (t) {
                if (t >= 0) {
                  if (t < server.pingT || server.pingT === -1) {
                    server.pingT = t;
                  }
                  if (t < SLOW_THRESHOLD) {
                    nextPing();
                  } else {
                    done();
                  }
                } else {
                  done();
                }
              }
            );
          };

          nextPing();
        }
      };
      //check servers in list, one by one
      const i = 0;
      const done = function () {
        let bestServer = null;

        for (let i = 0; i < serverList.length; i++) {
          if (
            serverList[i].pingT !== -1 &&
            (bestServer === null || serverList[i].pingT < bestServer.pingT)
          ) {
            bestServer = serverList[i];
          }
        }
        result(bestServer);
      };

      serverList.forEach(server => {
        checkServer(server, done);
      });

      if (i === serverList.length) {
        done();
      }
    };

    //parallel server selection
    const CONCURRENCY = 6;
    const serverLists: Array<Server[]> = [];

    for (let i = 0; i < CONCURRENCY; i++) {
      serverLists[i] = [];
    }
    for (let i = 0; i < this._serverList.length; i++) {
      serverLists[i % CONCURRENCY].push(this._serverList[i]);
    }
    let completed = 0;
    let bestServer: Server | null = null;

    for (let i = 0; i < CONCURRENCY; i++) {
      select(
        serverLists[i],
        (server: Server | null) => {
          if (server !== null) {
            if (bestServer === null || server.pingT < bestServer.pingT) {
              bestServer = server;
            }
          }
          completed++;
          if (completed === CONCURRENCY) {
            this._selectedServer = bestServer;
            this._state = 2;
            if (result) {
              result(bestServer);
            }
          }
        }
      );
    }
  }

  start() {
    if (this._state === 3) {
      throw 'Test already running';
    }
    this.worker = this.initWorker();

    this.worker.onmessage = (e: MessageEvent) => {
      if (e.data === this._prevData) {
        return;
      } else {
        this._prevData = e.data;
      }
      const data = e.data;

      try {
        if (this.onupdate) {
          this.onupdate(data);
        }
      } catch (error) {
        // LogManager.message('Speedtest onupdate event threw exception: ' + error, SentryLogLevel.ERROR);
        reportError(error);
      }
      if (data.testState >= 4) {
        try {
          if (this.onend) {
            this.onend(data.testState === 5);
          }
        } catch (error) {
          // LogManager.message('Speedtest onend event threw exception: ' + error, SentryLogLevel.ERROR);
          reportError(error);
        }
        if (this.updater !== null) {
          clearInterval(this.updater);
          this.updater = null;
        }
        this._state = 4;
      }
    };
    this.updater = setInterval(
      () => {
        this.worker?.postMessage('status');
      },
      300
    );
    if (this._state === 1) {
      throw 'When using multiple points of test, you must call selectServer before starting the test';
    }
    if (this._state === 2 && this._selectedServer) {
      this._settings.url_dl =
        this._selectedServer.server + this._selectedServer.dlURL;
      this._settings.url_ul =
        this._selectedServer.server + this._selectedServer.ulURL;
      this._settings.url_ping =
        this._selectedServer.server + this._selectedServer.pingURL;
      this._settings.url_getIp =
        this._selectedServer.server + this._selectedServer.getIpURL;
      if (typeof this._originalExtra !== 'undefined') {
        this._settings.telemetry_extra = JSON.stringify({
          server: this._selectedServer.name,
          extra: this._originalExtra
        });
      } else {
        this._settings.telemetry_extra = JSON.stringify({
          server: this._selectedServer.name
        });
      }
    }
    this._state = 3;
    this.worker.postMessage('start ' + JSON.stringify(this._settings));

    // ... [rest of the logic remains unchanged] ...
  }

  abort() {
    if (this._state < 3) {
      throw new Error('You cannot abort a test that\'s not started yet');
    }
    if (this._state < 4) {
      this.worker?.postMessage('abort');
    }
  }

  private initWorker(): Worker {
    if (this.workerUrl) {
      // TODO in destructor as well
      URL.revokeObjectURL(this.workerUrl);
    }
    this.workerUrl = URL.createObjectURL(new Blob([SpeedtestWorkerModule], { type: 'application/javascript' }));
    return new Worker(this.workerUrl);
  }
}
