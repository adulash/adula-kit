import customers from './resources/customers.js'
// adula:imports
export default {
  name: 'customers',
  reference: true,
  label: { ar: 'العملاء', en: 'Customers' },
  dependsOn: [],
  resources: [customers /* adula:resources */],
}
