import { useKnob } from '@dfosco/hypercanvas'

import './prototype.css'
import Branding from './Branding'
import SignupForm from './SignupForm'

export default function StartupSignup() {
  const layoutDirection = useKnob('layoutDirection') ?? 'horizontal'
  const isVerticalLayout = layoutDirection === 'vertical'

  return (
    <main
      className={`grid min-h-screen grid-cols-1 ${
        isVerticalLayout ? 'lg:grid-rows-2' : 'lg:grid-cols-2'
      }`}
    >
      <Branding />
      <SignupForm />
    </main>
  )
}
