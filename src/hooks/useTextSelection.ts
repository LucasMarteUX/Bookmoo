import React, { useState, useEffect, useCallback } from 'react'

interface SelectionState {
  text: string
  rect: DOMRect | null
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement>) {
  const [selection, setSelection] = useState<SelectionState>({ text: '', rect: null })

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !containerRef.current) {
      setSelection({ text: '', rect: null })
      return
    }

    // Ensure selection is within container
    const isAnchorInside = containerRef.current.contains(selection.anchorNode)
    const isFocusInside = containerRef.current.contains(selection.focusNode)
    
    if (!isAnchorInside && !isFocusInside) {
      setSelection({ text: '', rect: null })
      return
    }

    const rawText = selection.toString()
    // Remove leading/trailing non-word characters (punctuation, spaces, etc.)
    // but keep internal punctuation (like in "don't" or "well-known")
    const text = rawText.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '')
    
    if (!text) {
      setSelection({ text: '', rect: null })
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    setSelection({ text, rect })
  }, [containerRef])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    window.addEventListener('resize', handleSelectionChange)
    document.addEventListener('scroll', handleSelectionChange, true) // capture phase for all scroll events
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.removeEventListener('resize', handleSelectionChange)
      document.removeEventListener('scroll', handleSelectionChange, true)
    }
  }, [handleSelectionChange])

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges()
    setSelection({ text: '', rect: null })
  }

  return { ...selection, clearSelection }
}
