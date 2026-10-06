\version "2.24.0"

%{
  Skeleton for page 3 of an unidentified piano piece in D-flat major
  (plate no. 3435). Guessed: Chopin, Waltz Op. 64/1 - unconfirmed.

  CONVENTIONS
  - Measures are numbered 1-33 from the top of THIS page.
    LilyPond identifiers cannot contain digits, so numbers are spelled:
    \rhOne ... \rhThirtyThree, \lhOne ... \lhThirtyThree.
  - Every measure variable holds exactly ONE 2/4 bar (placeholder: R2).
  - Every measure variable is independent: its value is always the
    literal { R2 } placeholder, ready to be replaced by a script.
    Possible repetitions are only noted in comments ("REF mN": compare
    with measure N when transcribing); they are not assumed identical.
  - ALL clef and \ottava changes (including the long 8va over m15-22)
    go inside the measure variable where they occur. Write pitches at
    SOUNDING pitch; \ottava handles the printed position.
  - Two-voice bars: replace the placeholder with
        << { \voiceOne ... } \new Voice { \voiceTwo ... } >> \oneVoice
  - Dynamics, hairpins and pedalling live in separate Dynamics contexts
    (dynamicsMusic, pedalMusic), one s2 per bar, grouped by system.
  - Pitches are ABSOLUTE (no \relative), so variables can be reused
    and transposed safely.
  - System breaks follow the original: 6 | 6 | 6 | 7 | 8 bars.
%}

\header {
  title = "Untitled (D-flat major) - page 3"
  composer = "?"
  tagline = ##f
}

\paper {
  #(set-paper-size "a4")
}

startBar = #1   % set to the real bar number of the first bar on this page

global = {
  \key des \major
  \time 2/4   % inferred, not printed on this page
  % \omit Staff.TimeSignature   % uncomment to match the page exactly
}

% Fixes the system breaks only (6 | 6 | 6 | 7 | 8)
structure = {
  \set Score.currentBarNumber = \startBar
  s2*6 \break
  s2*6 \break
  s2*6 \break
  s2*7 \break
  s2*8 \bar "|."   % TODO: check the meaning of the "1" in m33 (rest count or 1st ending?)
}

%% =====================================================================
%% RIGHT HAND
%% =====================================================================

%% --- System 1 (m1-6) ---
% m1-2: 2 voices - upper repeated 16th dyads (stems up), lower 8th melody (stems down)
rhOne   = { << { \voiceOne bes'16( aes'' c'' aes'' ees''_\< aes'' f'' aes''\!) } \new Voice { \voiceTwo bes'8 c'' ees'' f'' } >> \oneVoice }
rhTwo   = { << { \voiceOne ees''16(_\> aes'' des''\! aes'' aes' aes'' aes' aes'') } \new Voice { \voiceTwo ees''8 des'' aes'4 } >> \oneVoice }
% m3-4: near-identical; short 8va inside each bar (TODO \ottava #1 ... \ottava #0)
rhThree = { r16 des''^(\< des''' des''' \ottava #1 des''''\! \ottava #0 des'' des''' des'') }
rhFour  = { << { \voiceTwo r16 des''^(\< des''' des''' \ottava #1 des''''\! \ottava #0 des'' bes'' bes') } \new Voice { \voiceOne s4 s8. bes'16 } >> \oneVoice }   % REF m3
rhFive  = { << { \voiceOne aes'16( <c'' aes''> g' g'' ges' ges'' ees' ees'') } \new Voice { \voiceTwo aes'8 g' ges' ees' } >> \oneVoice }
% m6: 16th rest, chord (fingering 4-2-1), 8th, 8th rest
rhSix   = { r16 des'( <aes'-2 des''-4> des''-1 des'''8-.-4) r8 }

%% --- System 2 (m7-12) ---
% PHRASE A = m7-10 (16th rest, rising figure with acciaccatura, falling runs)
rhSeven  = { r16 c''\( des'' d'' \acciaccatura g''!8 f''16_\< ees'' f'' g''! }
rhEight  = { bes''16-4\! aes''-2 des''' c''' bes'' aes'' g'' f''-3\) }
rhNine   = { ees''16-2\( aes''-5 c'' f''-3 \once \omit TupletNumber \tuplet 5/4 { ees''16 a' bes' c'' b'-3 } }
rhTen    = { c''16-5 g' \acciaccatura bes'!8 aes'!16 f' ees'8-.-1\) r8 }   % cadence of phrase A, 1st version
rhEleven = { r16 c''\( des'' d'' \acciaccatura g''!8 f''16_\< ees'' f'' g''! }   % REF m7 (phrase A restated?)
rhTwelve = { bes''16-4\! aes''-2 des''' c''' bes'' aes'' g'' f''-3\) }   % REF m8

%% --- System 3 (m13-18) ---
rhThirteen = { ees''16-2\( aes''-5 c'' f''-3 ees'' d'' des''-4 bes' }   % REF m9
rhFourteen = { aes'16-2\)_\< aes'-1( c'' ees'' aes''8-.)\! r8 }   % REF m10; cadence differs (grace figure, 8th, 8th rest)
% m15-22: long 8va - start it with \ottava #1 in m15, end with \ottava #0 in m22
rhFifteen   = { \ottava #1 r16 c''' des''' d''' \acciaccatura g'''!8 f'''16_\< ees''' f''' g'''! }   % REF m7, octave up; "sempre legato e leggiero"
rhSixteen   = { bes'''16-4\! aes'''-2 des'''' c'''' bes''' aes''' g''' f'''-3 }   % REF m8, octave up
rhSeventeen = { ees'''16-2 aes'''-5 c''' f'''-3 \once \omit TupletNumber \tuplet 5/4 { ees'''16 a'' bes'' c''' b''-3 } }   % REF m9, octave up
rhEighteen  = { c'''16-5_\( g'' \acciaccatura bes''!8 aes''!16 f'' ees''8-.\) r8 }   % REF m10, octave up

%% --- System 4 (m19-25) ---
rhNineteen  = { r16 c''' des''' d''' \acciaccatura g'''!8 f'''16_\< ees''' f''' g'''! }   % REF m11, octave up
rhTwenty    = { bes'''16-4\! aes'''-2 des'''' c'''' bes''' aes''' g''' f'''-3 }   % REF m12, octave up
rhTwentyOne = { ees'''16-2 aes'''-5 c''' f'''-3 ees''' d''' des'''-4 bes'' }   % REF m13, octave up
rhTwentyTwo = { aes''16-2_\< aes''-1( c''' ees''' aes'''8-.)\! \ottava #0 r8 }   % REF m14, octave up; ends with \ottava #0
% m23-25: double flats appear here - check accidentals carefully
rhTwentyThree = { r16 beses'16(\> aes' beses' aes' beses' ces'' beses'\! }
rhTwentyFour  = { aes'16)_\< aes'( c''! ees'' aes''8-.)\! r8 }
rhTwentyFive  = { r16 beses''16(\> aes'' beses'' aes'' beses'' ces''' beses''\! }

%% --- System 5 (m26-33) ---
rhTwentySix   = { aes''16)_\< aes''( c'''! ees''' aes'''8-.)\! r8 }   % possible fermata on the opening chord
% m27-29: sequence, each ending in a short 8va peak (\ottava inside the bars)
rhTwentySeven = { \ottava #1 r16 beses''16( des''' fes''' beses'''8-.) \ottava #0 r8 }
rhTwentyEight = { \ottava #1 r16 bes''!16( d''' f'''! bes'''!8-.) \ottava #0 r8 }   % REF m27 (sequence)
rhTwentyNine  = { \ottava #1 r16 ces'''16( d''' f''' ces''''8-.) \ottava #0 r8 }   % REF m27 (sequence)
% m30-31: rising arpeggio continuing from the LH (cross-staff), 8va at the top
rhThirty      = { R2 }
rhThirtyOne   = { r8. s16 s4 }
rhThirtyTwo   = { R2 }   % rest
rhThirtyThree = { R2_\markup \bold \larger "1" }   % rest, bar marked "1"

rhMusic = {
  \clef treble
  \rhOne \rhTwo \rhThree \rhFour \rhFive \rhSix
  \rhSeven \rhEight \rhNine \rhTen \rhEleven \rhTwelve
  \rhThirteen \rhFourteen \rhFifteen \rhSixteen \rhSeventeen \rhEighteen
  \rhNineteen \rhTwenty \rhTwentyOne \rhTwentyTwo
  \rhTwentyThree \rhTwentyFour \rhTwentyFive
  \rhTwentySix \rhTwentySeven \rhTwentyEight \rhTwentyNine
  \rhThirty \rhThirtyOne \rhThirtyTwo \rhThirtyThree
}

%% =====================================================================
%% LEFT HAND  (default pattern: bass 8th + staccato off-beat chord)
%% =====================================================================

%% --- System 1 (m1-6) ---
lhOne   = { << { aes,8[ <aes c' ges'> aes, <aes c' ges'>] } { s4.\sustainOn s16 s16\sustainOff } >> }
lhTwo   = { << { <des, des>8[( aes <des' f'>-.]) r8 } { s4.\sustainOn s16 s16\sustainOff } >> }
% m3-4: rolled chord (\arpeggio), mid-bar \clef treble, then \clef bass at the end
lhThree = { << { <f-5 des'-2>8\arpeggio[ \clef treble aes'-.-2] ces''4->-1 \clef bass } { s4.\sustainOn s16 s16\sustainOff } >> }
lhFour  = { << { <ges-5 des'-2>8\arpeggio[ \clef treble ges'-.-2] bes'4->-1 \clef bass } { s4.\sustainOn s16 s16\sustainOff } >> }   % REF m3
lhFive  = { << { aes,8[ <ges aes c'> aes, <ges aes c'>] } { s4.\sustainOn s16 s16\sustainOff } >> }
lhSix   = { << { des,4( <f aes des'>8-.) r8 } { s4.\sustainOn s16 s16\sustainOff } >> }

%% --- System 2 (m7-12) ---
lhSeven  = { << { aes,8-.[ <ees aes c'>-.] bes,8-.[ <ees g des'>-.] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }
lhEight  = { << { c8-.[ <e aes c'>-.] des8-.[ <f bes des'>-.] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }
lhNine   = { << { ees8-.[ <aes c'>-.] ees,8-.[ <g bes des'>-.] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }
lhTen    = { << { aes,8-.[ <ees aes c'>-.] r16 d16(\< f aes)\! } { s4\sustainOn s4\sustainOff } >> }
lhEleven = { << { aes,8-.[ <ees aes c'>-.] bes,8-.[ <ees g des'>-.] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m7
lhTwelve = { << { c8-.[ <e aes c'>-.] des8-.[ <f bes des'>-.] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m8

%% --- System 3 (m13-18) ---
lhThirteen = { << { ees8-.[ <aes c'>-.] ees,8-.[ <g bes des'>-.] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m9
lhFourteen = { << { aes,8[( ees <aes c'>-.]) r8 \clef treble } { s4.\sustainOn s8\sustainOff } >> }   % REF m10; ends with \clef treble after the rest
% m15-22: LH in treble clef
lhFifteen   = { << { aes8[ <c' ees' aes'>] bes8[ <des' ees' g'>] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m7, octave up?
lhSixteen   = { << { c'8[ <e' aes'>] des'8[ <f' bes'>] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m8, octave up?
lhSeventeen = { << { ees8[ <c' ees' aes'>] ees8[ <des' ees' g'>] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m9, octave up?
lhEighteen  = { << { aes8-.[ <c' ees' aes'>-.] r16 c'16(\< ees' aes')\! } { s4.\sustainOn s16 s16\sustainOff } >> }   % REF m10, octave up?

%% --- System 4 (m19-25) ---
lhNineteen    = { << { aes8[ <c' ees' aes'>] bes8[ <des' ees' g'>] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m11, octave up?
lhTwenty      = { << { c'8[ <e' aes'>] des'8[ <f' bes'>] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m12, octave up?
lhTwentyOne   = { << { ees'8[ <aes' c''>] ees8[ <des' ees' g'>] } { s8.\sustainOn s16\sustainOff s8.\sustainOn s16\sustainOff } >> }   % REF m13, octave up?
lhTwentyTwo   = { << { aes8[( ees' <aes' c''>-.]) r8 \clef bass } { s4.\sustainOn s8\sustainOff } >> }   % REF m14, octave up?; ends with \clef bass
% m23-26: 2 voices - tied half-note chord against moving notes; accent in m23
lhTwentyThree = { <g des' fes'>2_>( }
lhTwentyFour  = { << { <aes c' ees'>8-.) r8 aes,4-. \clef treble } { s4.\sustainOn s16 s16\sustainOff } >> }   % \clef treble late in the bar
lhTwentyFive  = { <g' des'' fes''>2^>( }

%% --- System 5 (m26-33) ---
lhTwentySix   = { << { <aes' c'' ees''>8-.) r8 aes8-. r8 } { s4.\sustainOn s16 s16\sustainOff } >> }
% m27-29: accented chord + staccato 8ths (sequence); \clef bass at end of m29
lhTwentySeven = { << { <g' des'' fes''>8->-.[ r aes-.] r8 } { s4.\sustainOn s16 s16\sustainOff } >> }
lhTwentyEight = { << { <aes' d'' f''!>8->-.[ r aes-.] r8 } { s4.\sustainOn s16 s16\sustainOff } >> }   % REF m27 (sequence)
lhTwentyNine  = { << { <aes' d'' f''>8->-.[ r aes-.] r8 \clef bass } { s4.\sustainOn s16 s16\sustainOff } >> }   % REF m27 (sequence)
% m30-31: arpeggio starts here and crosses to RH (\change Staff = "rh")
lhThirty      = { \stemUp aes,8-!\sustainOn[( ees16 c' \clef treble ees' ges' aes' c'' }
lhThirtyOne   = { ees''16 ges'' aes'' \change Staff = "rh" \stemDown \ottava #1 c''' ees''' ges''' aes''' c'''']) \ottava #0 \change Staff = "lh" \stemNeutral }
lhThirtyTwo   = { \ottava #1 aes''''8-. \ottava #0 r8 r4\sustainOff }   % single note under \ottava #1, fz
lhThirtyThree = { R2 \clef bass }   % rest, bar marked "1"

lhMusic = {
  \clef bass
  \lhOne \lhTwo \lhThree \lhFour \lhFive \lhSix
  \lhSeven \lhEight \lhNine \lhTen \lhEleven \lhTwelve
  \lhThirteen \lhFourteen \lhFifteen \lhSixteen \lhSeventeen \lhEighteen
  \lhNineteen \lhTwenty \lhTwentyOne \lhTwentyTwo
  \lhTwentyThree \lhTwentyFour \lhTwentyFive
  \lhTwentySix \lhTwentySeven \lhTwentyEight \lhTwentyNine
  \lhThirty \lhThirtyOne \lhThirtyTwo \lhThirtyThree
}

%% =====================================================================
%% DYNAMICS (between staves) - one s2 per bar; refine with s4/s8 + hairpins
%% =====================================================================
dynamicsMusic = {
  % System 1 (m1-6): short hairpins
  s2 s2 s2 s2 s2 s2
  % System 2 (m7-12): p at m7, hairpins
  s2\p s2 s2 s2 s2 s2
  % System 3 (m13-18): hairpins; "sempre legato e leggiero" at m15
  s2 s2 s2^\markup \italic "sempre legato e leggiero" s2 s2 s2
  % System 4 (m19-25): f at m23
  s2 s2 s2 s2 s2\f s2 s2
  % System 5 (m26-33): cre-scen-do over m27-29, f at m30, fz at m32
  s2 s2\cresc s2 s2 s2\f s2 s2\fz s2
}

%% =====================================================================
%% PEDAL (below LH) - nearly every half bar: s4\sustainOn s4\sustainOff
%% =====================================================================
pedalMusic = {
  % System 1
  s2 s2 s2 s2 s2 s2
  % System 2
  s2 s2 s2 s2 s2 s2
  % System 3
  s2 s2 s2 s2 s2 s2
  % System 4
  s2 s2 s2 s2 s2 s2 s2
  % System 5
  s2 s2 s2 s2 s2 s2 s2 s2
}

%% =====================================================================
%% SCORE
%% =====================================================================
\score {
  \new PianoStaff <<
    \new Staff = "rh" << \global \structure \rhMusic >>
    \new Dynamics \dynamicsMusic
    \new Staff = "lh" << \global \lhMusic >>
    \new Dynamics \pedalMusic
  >>
  \layout {
    \context { \Score \override SpacingSpanner.common-shortest-duration = #(ly:make-moment 1/16) }
  }
}
