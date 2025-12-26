import { Events, Playback } from '@clappr/core'
import { Events as HlsEvents, FragChangedData } from 'hls.js'

const OUT = 'out',
  IN = 'in',
  OUT_CONT = 'out_cont'

type CueResult = { kind?: 'in' | 'out' | 'out_cont'; duration?: number }

export default class SCTEManager extends Events {
  private _playback: Playback | null = null

  private _scteIsStarted = false

  set playback(value: Playback) {
    if (this._playback) {
      //удалить все подписанные евенты
      // @ts-ignore
      if (this._playback._hls) {
        // @ts-ignore
        this._playback._hls.off(
          HlsEvents.FRAG_CHANGED,
          this._onHlsFragChanged.bind(this),
        )
      }

      this._playback.off(
        Events.PLAYBACK_PLAY_INTENT,
        this._subscribedHlsEvents,
        this,
      )
    }
    this._playback = value
    // @ts-ignore
    if (!this._playback._hls) {
      this._playback.once(
        Events.PLAYBACK_PLAY_INTENT,
        this._subscribedHlsEvents,
        this,
      )
    } else {
      this._subscribedHlsEvents()
    }
  }

  get playback(): Playback | null {
    return this._playback
  }

  _subscribedHlsEvents() {
    // @ts-ignore
    if (this._playback._hls) {
      // @ts-ignore
      this._playback._hls.off(
        HlsEvents.FRAG_CHANGED,
        this._onHlsFragChanged.bind(this),
      )
      // @ts-ignore
      this._playback._hls.on(
        HlsEvents.FRAG_CHANGED,
        this._onHlsFragChanged.bind(this),
      )
    }
  }

  _onHlsFragChanged(_: HlsEvents.FRAG_CHANGED, data: FragChangedData) {
    const { tagList } = data.frag

    if (tagList) {
      const cue = this._getCue(tagList)

      if (Object.keys(cue).length > 0) {
        if (!this._scteIsStarted) {
          if (cue.kind === OUT || cue.kind === OUT_CONT) {
            this._scteIsStarted = true
            console.warn('scteroll will be started')
            this.trigger('startSCTERoll', {
              duration: cue.duration,
            })
          }
        } else {
          if (cue.kind === IN) {
            console.warn('scteroll will be stopped')
            this._stopScte()
          }
        }
      } else {
        this._stopScte()
      }
    }
  }

  _stopScte() {
    if (this._scteIsStarted) {
      this.trigger('stopSCTERoll')
      this._scteIsStarted = false
    }
  }

  _getCue(tagList: string[][]): CueResult {
    let cueResult: CueResult = {
      kind: undefined,
      duration: undefined,
    }

    for (let i = 0; i < tagList.length; i++) {
      const infoSegment = tagList[i]
      let kind: 'in' | 'out' | 'out_cont' | undefined
      let duration: number | undefined

      infoSegment.forEach((info) => {
        if (kind) {
          if (kind === OUT) {
            const dur = parseInt(info)

            !isNaN(dur) && (duration = dur)
          }
          if (kind === OUT_CONT) {
            const durString = info.match(/Duration=\d+/g)

            if (durString) {
              const durNumb = durString[0].match(/\d+/g)

              if (durNumb) {
                duration = parseInt(durNumb[0])
              }
            }
          }
        } else {
          switch (info) {
            case 'EXT-X-CUE-OUT':
              kind = OUT
              break
            case 'EXT-X-CUE-OUT-CONT':
              kind = OUT_CONT
              break
            case 'EXT-X-CUE-IN':
              kind = IN
              break
          }
        }
      })
      kind &&
        (cueResult = {
          kind,
          duration,
        })
    }

    return cueResult
  }
}
