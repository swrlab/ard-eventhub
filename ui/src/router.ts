import { createRouter, createWebHistory } from 'vue-router'
import ClusterView from './views/ClusterView.vue'
import ConnectionsView from './views/ConnectionsView.vue'
import OnAirView from './views/OnAirView.vue'
import RejectionsView from './views/RejectionsView.vue'
import TailView from './views/TailView.vue'

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: '/', redirect: '/on-air' },
		{ path: '/on-air', name: 'on-air', component: OnAirView },
		{ path: '/connections', name: 'connections', component: ConnectionsView },
		{ path: '/rejections', name: 'rejections', component: RejectionsView },
		{ path: '/cluster', name: 'cluster', component: ClusterView },
		{ path: '/tail', name: 'tail', component: TailView },
		{ path: '/:pathMatch(.*)*', redirect: '/on-air' },
	],
})
