import { useEffect, useState } from 'react'
import { cardMap } from './utils/cards'
import Card from './components/Card'
import { motion, AnimatePresence } from 'framer-motion'

const possibleCardNames = Object.keys(cardMap)

function App() {
  // The card has started being dealt, but is still animating in
  const [cardDealing, setCardDealing] = useState(false)
  // The card has been fully dealt
  const [cardDealt, setCardDealt] = useState(false)
  // Which card has been chosen
  const [card, setCard] = useState<string | null>(null)
  // If the card is face up or down
  const [faceUp, setFaceUp] = useState(false)

  useEffect(() => {
    setCard(possibleCardNames[Math.floor(Math.random() * possibleCardNames.length)])
  }, [])

  return (
    // z-0 starts a new stacking context here (I think?)
    <div className="relative z-0 bg-black" onClick={() => { setCardDealing(true) }}>
      <div className="h-screen overflow-hidden z-10 flex items-center justify-center">
        <AnimatePresence>
          {(cardDealing || cardDealt) && (
            // NOTE we use 100vh since the container fills the screen, and 50% since that's the
            // height of the card. Update this if either of those changes!
            <motion.div
              initial={{ y: 'calc(100vh - 50%)' }}
              animate={{ y: '0vh', transition: { duration: 2, ease: 'easeOut' } }}
              onAnimationComplete={() => {
                setCardDealing(false)
                setCardDealt(true)
              }}
            >
              <Card
                cardName={card}
                faceUp={faceUp}
                className="h-1/2"
                onClick={() => {
                  if (cardDealt) setFaceUp(true)
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {!cardDealing && !cardDealt && (
          <motion.div
            className="absolute inset-0 -z-10 flex items-center justify-center"
            exit={{ opacity: 0, transition: { duration: 1 } }}
          >
            <span className="text-gray-900 text-9xl uppercase font-bold select-none">
              Click to Deal
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
