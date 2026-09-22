import tasks from './resources/tasks.js'
// adula:imports
export default {
  name: 'tasks',
  reference: true,
  label: { ar: 'المهام', en: 'Tasks' },
  dependsOn: ['orders'],
  resources: [tasks /* adula:resources */],
}
