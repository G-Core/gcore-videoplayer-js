import { StreamMediaSource, StreamMediaSourceDto } from "./types";

export function fromStreamMediaSourceDto(s: StreamMediaSourceDto): StreamMediaSource {
  return ({
    ...s,
    hlsCmafUrl: s.hls_cmaf_url ?? null,
    hlsMpegtsUrl: s.hls_mpegts_url ?? null,
    priorityTransport: s.priority_transport,
    sourceDash: s.source_dash,
    vtt: s.vtt,
  });
}
