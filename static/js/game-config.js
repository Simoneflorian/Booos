// ======================================================================
//  Visual configuration for the Pinguin Jump & Run game.
//  Everything here controls the *look* only — palettes, noise ranges,
//  parallax layers, fog, snow and vignette. Tweak freely; the game logic
//  in game.js never needs to change.
// ======================================================================
window.GAME_CONFIG = {
    // ---- Time-of-day keyframe palettes (interpolated by the system clock) --
    // Each: one dominant colour family broken by a single saturated accent.
    palettes: [
        { h: 0,  sky: [[0,[12,16,34]],[0.5,[22,30,58]],[0.78,[40,46,78]],[1,[30,40,66]]],
          ice:[150,168,196], iceShadow:[64,82,120], iceLight:[206,220,240], light:[196,208,236],
          fog:[26,34,60], particle:[210,224,246], water:[[24,50,84],[8,20,42]], accent:[226,232,252] },
        { h: 5,  sky: [[0,[42,44,88]],[0.45,[98,86,132]],[0.72,[196,138,138]],[1,[238,198,168]]],
          ice:[196,196,214], iceShadow:[116,106,138], iceLight:[240,224,214], light:[248,206,178],
          fog:[150,128,148], particle:[244,224,224], water:[[52,74,110],[24,40,68]], accent:[250,192,146] },
        { h: 8,  sky: [[0,[110,150,190]],[0.5,[172,202,224]],[0.76,[220,224,224]],[1,[228,238,244]]],
          ice:[214,230,240], iceShadow:[118,150,178], iceLight:[248,252,255], light:[255,244,222],
          fog:[176,200,220], particle:[236,246,252], water:[[58,120,156],[20,58,92]], accent:[255,236,196] },
        { h: 12, sky: [[0,[92,148,206]],[0.5,[160,200,236]],[0.8,[212,232,246]],[1,[228,242,250]]],
          ice:[224,238,248], iceShadow:[130,166,196], iceLight:[255,255,255], light:[255,252,240],
          fog:[190,216,236], particle:[244,250,255], water:[[64,138,176],[18,66,102]], accent:[255,250,232] },
        { h: 18, sky: [[0,[54,70,116]],[0.4,[178,116,120]],[0.7,[238,150,94]],[1,[250,198,120]]],
          ice:[236,206,196], iceShadow:[122,92,116], iceLight:[252,224,190], light:[255,176,108],
          fog:[196,128,108], particle:[252,214,190], water:[[92,88,120],[38,42,72]], accent:[255,146,74] },
        { h: 21, sky: [[0,[22,26,56]],[0.5,[52,54,94]],[0.78,[92,84,124]],[1,[128,112,142]]],
          ice:[166,174,202], iceShadow:[82,86,124], iceLight:[214,214,236], light:[196,180,206],
          fog:[62,62,98], particle:[214,214,238], water:[[38,50,84],[16,26,50]], accent:[212,182,216] },
    ],

    // Sun visible dayStart..dayEnd (incl. twilight); moon otherwise.
    body: { dayStart: 5, dayEnd: 19 },

    // ---- Parallax depth layers (back to front) ---------------------------
    // Atmospheric perspective: far layers are hazed toward the fog/sky
    // colour, lightened and blurred; near layers keep contrast and detail.
    //   parallax : scroll factor vs the camera (smaller = further away)
    //   haze     : how strongly the layer is washed toward the fog colour
    //   blur     : gaussian blur (px) baked into the tinted sprite
    //   bob      : gentle vertical ambient sway amplitude (px)
    tiers: [
        { id: "far",  kind: "mountain", parallax: 0.16, count: 9,  spacing: 240, baseY: 430, jitterY: 8,
          sizeScale: 1.3,  haze: 0.62, blur: 2.4, bob: 0.6, seedBase: 2000,
          shape: { wMin: 200, wMax: 340, hMin: 130, hMax: 210, jagMin: 0.05, jagMax: 0.11, peakMin: 0.30, peakMax: 0.70 } },
        { id: "mid",  kind: "berg", parallax: 0.32, count: 12, spacing: 240, baseY: 444, jitterY: 10,
          sizeScale: 1.0,  haze: 0.40, blur: 1.1, bob: 1.3, seedBase: 3000,
          shape: { wMin: 120, wMax: 240, hMin: 90,  hMax: 150, jagMin: 0.08, jagMax: 0.16, peakMin: 0.28, peakMax: 0.72 } },
        { id: "near", kind: "berg", parallax: 0.55, count: 10, spacing: 300, baseY: 450, jitterY: 8,
          sizeScale: 0.85, haze: 0.16, blur: 0.0, bob: 1.9, seedBase: 4000,
          shape: { wMin: 90,  wMax: 180, hMin: 70,  hMax: 120, jagMin: 0.10, jagMax: 0.20, peakMin: 0.25, peakMax: 0.75 } },
        { id: "fg",   kind: "berg", parallax: 1.18, count: 8,  spacing: 360, baseY: 490, jitterY: 6,
          sizeScale: 0.75, haze: 0.0,  blur: 0.7, bob: 0.0, alpha: 0.9, darken: 0.14, seedBase: 5000,
          shape: { wMin: 90,  wMax: 170, hMin: 34,  hMax: 62,  jagMin: 0.12, jagMax: 0.22, peakMin: 0.30, peakMax: 0.70 } },
    ],

    // ---- Drifting, pulsing haze bands between the depth planes ------------
    fogBands: [
        { y: 296, h: 120, baseAlpha: 0.10, pulse: 0.035, pulseSpeed: 0.45, drift: 9,  puffs: 6 },
        { y: 396, h: 96,  baseAlpha: 0.14, pulse: 0.05,  pulseSpeed: 0.7,  drift: 14, puffs: 7 },
    ],

    // ---- Snow: three depth layers (far small/slow/blurry → near big/fast) -
    snow: [
        { count: 34, sizeMin: 1.2, sizeMax: 2.2, speedMin: 12, speedMax: 22, driftAmp: 8,
          driftFreqMin: 0.4, driftFreqMax: 0.8, alphaMin: 0.22, alphaMax: 0.42, soft: 0.9, crisp: false },
        { count: 28, sizeMin: 2.0, sizeMax: 3.4, speedMin: 26, speedMax: 44, driftAmp: 14,
          driftFreqMin: 0.5, driftFreqMax: 1.0, alphaMin: 0.4,  alphaMax: 0.7,  soft: 0.55, crisp: false },
        { count: 18, sizeMin: 2.8, sizeMax: 4.6, speedMin: 48, speedMax: 74, driftAmp: 22,
          driftFreqMin: 0.6, driftFreqMax: 1.3, alphaMin: 0.6,  alphaMax: 0.95, soft: 0.2,  crisp: true },
    ],

    // ---- Subtle coloured (not black) vignette ----------------------------
    vignette: { alpha: 0.32, mixShadow: 0.45 },

    // ---- Procedural paper/grain overlay ----------------------------------
    grain: { alpha: 0.05, tile: 128 },

    // How often (in clock-minutes) the cached layers are re-tinted to the
    // drifting palette. Small = smoother colour, larger = cheaper.
    retintMinutes: 10,
};
