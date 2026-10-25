'use client'

import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

export default function Preloader() {
    const { active, progress, total } = useProgress()
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        if (total > 0 && !active) setLoaded(true)
    }, [active, total])

    // Some pages do not mount a Drei loader at all. In that case `total` stays
    // at zero forever, so always provide a short, deterministic escape hatch.
    useEffect(() => {
        const fallback = window.setTimeout(() => setLoaded(true), 250)
        return () => window.clearTimeout(fallback)
    }, [])

    if (loaded) return null;

    return (
        <div
            aria-hidden={loaded}
            className={`preloader fixed inset-0 z-80 flex items-center justify-center bg-background transition-opacity duration-300 ${loaded ? 'pointer-events-none opacity-0 hidden' : ''}`}
        >
            <div className='preloader__mark'>
                <span className='preloader__seal'>V</span>
                <span className='preloader__copy'>Establishing trust chain</span>
                <span className='preloader__progress'>{total > 0 ? `${Math.round(progress)}%` : 'INITIALIZING'}</span>
            </div>
        </div>
    )
}
