import { ref } from 'vue'

/** Tail phase shown in the shell. The socket is not how the boards stay current. */
export const tailPhase = ref<'closed' | 'live' | 'sampled'>('closed')
