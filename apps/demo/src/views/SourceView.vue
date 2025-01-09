<template>
  <div class="source-settings">
    <div class="controls">
      <div>
        <label for="token" class="label">Token</label>
      </div>
      <div>
        <input type="text" id="token" v-model="token" />
      </div>
      <div class="label">
        Kind
      </div>
      <div class="radiogroup">
        <label for="kind_stream">
          <input type="radio" name="kind" value="stream" v-model="kind" id="kind_stream" />
          Live stream
        </label>
        <label for="kind_video">
          <input type="radio" name="kind" value="video" v-model="kind" id="kind_video" />
          Video
        </label>
      </div>
      <div>
        <label for="stream_id" class="label">ID</label>
      </div>
      <div>
        <input type="text" id="stream_id" v-model="streamId" />
      </div>
      <div></div>
      <div class="buttons">
        <button @click="fetchItem" :disabled="!resourceUrl || !token || pending">Fetch</button>
        <button @click="clear">Clear</button>
      </div>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <pre class="stream-inf" v-if="streamInfo">{{ JSON.stringify(streamInfo, null, 2) }}</pre>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import useSettingsStore from '../store/settings';
import usePersistence from '../composables/use-persistence';

const API_URL = 'https://api.gcore.com/streaming';

const streamId = ref(0);

const token = ref('')

const streamInfo = ref<Record<string, unknown> | null>(null);

const error = ref('');

const pending = ref(false);

type ItemKind = 'stream' | 'video';

const kind = ref<ItemKind>('stream'); // TODO persist

const resourceUrl = computed(() => {
  return streamId.value ?  `${API_URL}/${kind.value}s/${streamId.value}` : '';
});

const settings = useSettingsStore();

const persistedstreamId = usePersistence('source.streamId', String, Number);
const id = (a: string) => a;
const persistedToken = usePersistence('source.token', id, id);
const persistKind = usePersistence('source.kind', id, id);

watch(streamId, (val) => {
  if (val) {
    persistedstreamId.set(val)
  }
});

watch(token, (val) => {
  if (val) {
    persistedToken.set(val);
  }
})

watch(kind, (val) => {
  persistKind.set(val);
})

watch(streamInfo, (val) => {
  if (val) {
    settings.setStreamSource({
      master: val.uri || val.hls_url,
      dash: val.dash_url,
      hlsCmaf: val.hls_cmaf_url,
      hlsMpegts: val.hls_mpegts_url,
      screenshot: val.screenshot,
    });
  }
})

onMounted(() => {
  streamId.value = persistedstreamId.get(0);
  token.value = persistedToken.get('');
  kind.value = persistKind.get('stream');
});

function setStreamInfo(si: Record<string, unknown>) {
  streamInfo.value = si;
  settings.setStreamSource({
    master: si.uri,
    dash: si.dash_url,
    hlsCmaf: si.hls_cmaf_url,
    hlsMpegts: si.hls_mpegts_url,
    poster: si.poster || si.screenshot,
  });
}

function fetchItem() {
  pending.value = true;
  error.value = '';
  console.log("fetchItem", resourceUrl.value, token.value);

  fetch(resourceUrl.value, {
    headers: {
      authorization: `APIKey ${token.value}`
    },
    mode: 'cors',
  }).then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
    }
    return res.json()
  })
    .then((data) => {
      setStreamInfo(data);
    })
    .catch(e => {
      error.value = String(e);
    })
    .finally(() => {
      pending.value = false;
    })
}

function clear() {
  streamInfo.value = null;
  token.value = '';
  streamId.value = 0;
  error.value = '';
}
</script>

<style lang="css" scoped>
.controls {
  display: grid;
  grid-auto-rows: auto;
  grid-template-columns: max-content auto;
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;;
}
.label {
  font-weight: 600;
}
.error {
  color: var(--color-error);
}
.buttons {
  display: flex;
  gap: 1rem;
}
pre {
  word-wrap: break-word;
}
</style>
