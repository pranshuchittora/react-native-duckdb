import React from 'react'
import './tests/build.test'
import './tests/lifecycle.test'
import './tests/errors.test'
import './tests/query.test'
import './tests/transaction.test'
import './tests/types.test'
import './tests/columnar.test'
import { TestSuiteScreen } from './screens/TestSuiteScreen'

export default function App() {
  return <TestSuiteScreen />
}
