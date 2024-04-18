import React, { useMemo } from 'react'
import { MainScreen, UpdaterScreen } from '@/screens'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Box } from '@mui/material'

export const Navigator = () => {
  const location = useLocation()
  const titleBarHeight = useMemo(() => (location.pathname === '/' ? window.titleBar!.height : '0px'), [location])

  return (
    <>
      {/* <TitleBar /> */}
      <Box sx={{ display: 'flex', height: `calc(100vh - ${titleBarHeight})` }}>
        <Routes>
          <Route path='/' element={<MainScreen />} />
          <Route path='updater' element={<UpdaterScreen />} />
        </Routes>
      </Box>
    </>
  )
}
