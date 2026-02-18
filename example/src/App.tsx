import React from 'react'
import './tests/build.test'
import './tests/lifecycle.test'
import './tests/errors.test'
import './tests/query.test'
import { TestSuiteScreen } from './screens/TestSuiteScreen'

export default function App() {
  return <TestSuiteScreen />
}
