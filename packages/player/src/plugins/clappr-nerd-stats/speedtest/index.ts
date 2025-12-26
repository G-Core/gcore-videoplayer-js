import { type Server, type TestStatusInfo, Speedtest } from './Speedtest.js'
import { SpeedtestMetrics } from './types.js'

const DIGITS_THRESHOLD = 99999
const DEFAULT_DOWNLOAD_SPEED = '0.00'

const DRAW_SIZE = 5

// const T = 'plugins.clappr_nerd_stats.speedtest';

function limitDigits(value: number): string {
  return value > DIGITS_THRESHOLD ? '> ' + DIGITS_THRESHOLD : value.toFixed(2)
}

function getElementById(id: string): Element | null {
  return document.getElementById(id)
}

const speedTest = new Speedtest()

const speedtestResults: number[] = []

const serversList: Server[] = []

const getColor = (speedValue: number): string => {
  if (speedValue < 3) {
    return '#df564d'
  } else if (speedValue < 7) {
    return '#df934d'
  } else if (speedValue < 13) {
    return '#dfd04d'
  } else if (speedValue < 25) {
    return '#c2df4d'
  } else {
    return '#73df4d'
  }
}

export function drawSpeedTestResults() {
  const canvas = document.getElementById('nerd-stats-speed-test-canvas')
  if (!canvas) {
    return
  }
  const ctx = (canvas as HTMLCanvasElement).getContext('2d')
  if (!ctx) {
    return
  }
  ctx.clearRect(
    0,
    0,
    (canvas as HTMLCanvasElement).width,
    (canvas as HTMLCanvasElement).height,
  )

  const barWidth = (canvas as HTMLCanvasElement).width / DRAW_SIZE

  for (let i = 0; i < speedtestResults.length; i++) {
    const height =
      (speedtestResults[i] / 100) * (canvas as HTMLCanvasElement).height // assuming max speed is 100 for 100% height

    ctx.fillStyle = getColor(speedtestResults[i])
    ctx.fillRect(
      i * barWidth,
      (canvas as HTMLCanvasElement).height - height,
      barWidth,
      height,
    )
  }
}

let inited: Promise<void> | null = null

export const initSpeedTest = (
  customMetrics: SpeedtestMetrics,
): Promise<void> => {
  if (inited !== null) {
    return inited
  }
  inited = (async () => {
    // TODO: fix server selection
    // const response = await fetch('https://iam.gcdn.co/info/json');
    // const data = await response.json();

    // SPEEDTEST_SERVERS[0].server = `http://${data.Server}.fe.gc.onl/speedtest/`;

    speedTest.onupdate = function (data: TestStatusInfo) {
      //callback to update data in UI
      if (
        ![0, 1].includes(data.testState) &&
        typeof data.dlStatus === 'number'
      ) {
        const dlSpeed = limitDigits(data.dlStatus)
        const el = getElementById('dlText')
        if (el) {
          el.textContent = dlSpeed
        }
        customMetrics.connectionSpeed = rankConnectionSpeed(data.dlStatus)
      }

      const pingStatus = parseFloat(data.pingStatus)
      if (pingStatus > 0) {
        const el = getElementById('pingText')
        if (el) {
          el.textContent = data.pingStatus
        }
        customMetrics.ping = pingStatus
      }

      const jitterStatus = parseFloat(data.jitterStatus)
      if (jitterStatus > 0) {
        const el = getElementById('jitterText')
        if (el) {
          el.textContent = data.jitterStatus
        }
        customMetrics.jitter = jitterStatus
      }

      if (data.dlStatus === 0) {
        return
      }
      if (typeof data.dlStatus === 'number') {
        speedtestResults.push(data.dlStatus)
      }

      // Keep only the last 10 results
      if (speedtestResults.length > DRAW_SIZE) {
        speedtestResults.shift()
      }

      drawSpeedTestResults()
    }

    speedTest.onend = function (aborted: boolean) {
      //callback for test ended/aborted
      if (aborted) {
        //if the test was aborted, clear the UI and prepare for new test
        // TODO: fix
        const el = getElementById('dlText')
        if (el) {
          el.textContent = DEFAULT_DOWNLOAD_SPEED
        }
      }
    }

    const myinfoUrl = 'https://gcore.com/.well-known/cdn-debug/json'
    // await fetch('https://iam.gcdn.co/info/json')
    await fetch(myinfoUrl)
      .then((r) => r.json())
      .then((data) => {
        // const country = data['Server Country code'].toLowerCase();
        const country = getCountryCodeFromClientHeaders(data.client_headers)
        const server =
          serversList.find((s) => s.country === country) || serversList[0]
        if (!server) {
          throw new Error('Failed to select a server')
        }
        speedTest.addTestPoint(server)
        speedTest.setSelectedServer(server)
      })
  })()

  return inited
}

export const stopSpeedtest = () => {
  if (speedTest.getState() === 3) {
    speedTest.abort()
  }
}

export const startSpeedtest = () => {
  if (speedTest.getState() !== 3) {
    speedTest.start()
  }
}

export const clearSpeedTestResults = () => {
  speedtestResults.splice(0, speedtestResults.length)
}

export function configureSpeedTest(servers: Server[]) {
  // speedTest.addTestPoints(servers);
  serversList.push(...servers)
}

type ConnectionSpeed = 0 | 1 | 2 | 3 | 4 | 5

function rankConnectionSpeed(dlSpeed: number): ConnectionSpeed {
  if (dlSpeed >= 100) {
    return 5
  }
  if (dlSpeed >= 25) {
    return 4
  }
  if (dlSpeed >= 10) {
    return 3
  }
  if (dlSpeed >= 2) {
    return 2
  }
  if (dlSpeed >= 0.5) {
    return 1
  }
  return 0
}

function getCountryCodeFromClientHeaders(
  clientHeaders: Record<string, string>,
): string {
  if (clientHeaders && clientHeaders['country']) {
    const m = clientHeaders['country'].match(/'code':\s*'([A-Za-z]{2})'/)
    if (m) {
      return m[1].toLowerCase()
    }
  }
  return 'lu'
}
