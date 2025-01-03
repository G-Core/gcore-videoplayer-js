import { type Server, type TestStatusInfo, Speedtest } from './Speedtest.js';
import { CustomMetrics } from './types.js';

const DIGITS_THRESHOLD = 99999;
const DEFAULT_DOWNLOAD_SPEED = '0.00';

// const SPEEDTEST_SERVERS = [
//   {
//     'id': 4,
//     'name': 'Paris (France)',
//     'server': 'http://am3-hw-edge-gc92.fe.gc.onl/speedtest/',
//     'country': 'fr',
//     'dlURL': 'backend/garbage.php',
//     'ulURL': 'backend/empty.php',
//     'pingURL': 'backend/empty.php',
//     'getIpURL': 'backend/getIP.php',
//     'pingT': 269.40000000037253
//   }
// ];

const SPEEDTEST_SERVERS: Server[] = [
  {
    'id': 4,
    'name': 'Paris (France)',
    'server': 'https://am3-speedtest.tools.gcore.com/',
    'country': 'fr',
    'dlURL': 'speedtest-backend/garbage.php',
    'ulURL': 'speedtest-backend/empty.php',
    'pingURL': 'speedtest-backend/empty.php',
    'getIpURL': 'speedtest-backend/getIP.php',
    'pingT': 269.40000000037253
  }
];

const DRAW_SIZE = 5;

function limitDigits(value: number): string {
  return value > DIGITS_THRESHOLD ? '> ' + DIGITS_THRESHOLD : value.toFixed(2);
}

function getElementById(id: string): Element | null {
  return document.getElementById(id);
}

const speedTest = new Speedtest();

const speedtestResults: number[] = [];

const getColor = (speedValue: number): string => {
  if (speedValue < 3) {
    return '#df564d';
  } else if (speedValue < 7) {
    return '#df934d';
  } else if (speedValue < 13) {
    return '#dfd04d';
  } else if (speedValue < 25) {
    return '#c2df4d';
  } else {
    return '#73df4d';
  }
};

export function drawSpeedTestResults() {
  const canvas = document.getElementById('speedTestCanvas');
  if (!canvas) {
    return;
  }
  const ctx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height);

  const barWidth = (canvas as HTMLCanvasElement).width / DRAW_SIZE;

  for (let i = 0; i < speedtestResults.length; i++) {
    const height = (speedtestResults[i] / 100) * (canvas as HTMLCanvasElement).height; // assuming max speed is 100 for 100% height

    ctx.fillStyle = getColor(speedtestResults[i]);
    ctx.fillRect(i * barWidth, (canvas as HTMLCanvasElement).height - height, barWidth, height);
  }
}

let inited: Promise<void> | null = null;

export const initSpeedTest = (customMetrics: CustomMetrics): Promise<void> => {
  if (inited !== null) {
    return inited;
  }
  inited = (async () => {
    // TODO: fix server selection
    // const response = await fetch('https://iam.gcdn.co/info/json');
    // const data = await response.json();

    // SPEEDTEST_SERVERS[0].server = `http://${data.Server}.fe.gc.onl/speedtest/`;

    speedTest.onupdate = function (data: TestStatusInfo) { //callback to update data in UI
      if (![0, 1].includes(data.testState) && typeof data.dlStatus === 'number') {
        const dlSpeed = limitDigits(data.dlStatus);
        const el = getElementById('dlText');
        if (el) {
          el.textContent = dlSpeed;
        }
        customMetrics.connectionSpeed = 0; // TODO rank 0..5
      }

      const pingStatus = parseFloat(data.pingStatus);
      if (pingStatus > 0) {
        const el = getElementById('pingText');
        if (el) {
          el.textContent = data.pingStatus;
        }
        customMetrics.ping = pingStatus;
      }

      const jitterStatus = parseFloat(data.jitterStatus);
      if (jitterStatus > 0) {
        const el = getElementById('jitterText');
        if (el) {
          el.textContent = data.jitterStatus;
        }
        customMetrics.jitter = jitterStatus;
      }

      if (data.dlStatus === 0) {
        return;
      }
      if (typeof data.dlStatus === 'number') {
        speedtestResults.push(data.dlStatus);
      }

      // Keep only the last 10 results
      if (speedtestResults.length > DRAW_SIZE) {
        speedtestResults.shift();
      }

      drawSpeedTestResults();
    };

    speedTest.onend = function (aborted: boolean) { //callback for test ended/aborted
      if (aborted) { //if the test was aborted, clear the UI and prepare for new test
        // TODO: fix
        const el = getElementById('dlText');
        if (el) {
          el.textContent = DEFAULT_DOWNLOAD_SPEED;
        }
      }
    };
    // getElementById('dlText').textContent = DEFAULT_DOWNLOAD_SPEED;

    speedTest.addTestPoints(SPEEDTEST_SERVERS);
  })();

  return inited;
};

export const stopSpeedtest = () => {
  if (speedTest.getState() === 3) {
    speedTest.abort();
  }
};

export const startSpeedtest = () =>  {
  if (speedTest.getState() !== 3) {
    speedTest.setSelectedServer(SPEEDTEST_SERVERS[0]);
    speedTest.start();
  }
};

export const clearSpeedTestResults = () => {
  speedtestResults.splice(0, speedtestResults.length);
};
