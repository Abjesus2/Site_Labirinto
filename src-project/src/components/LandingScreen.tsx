import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import './LandingScreen.css';

interface LandingScreenProps {
  onStart: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onStart }) => {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activeWrapper: any = null;
    let startMouseX = 0, startMouseY = 0;
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    
    const wrappers = document.querySelectorAll(".parallax-wrapper");
    
    // Initialize drag variables
    wrappers.forEach((w: any) => { w.dragX = 0; w.dragY = 0; w.isSpringing = false; });

    function getX(e: any) { return e.touches ? e.touches[0].clientX : e.clientX; }
    function getY(e: any) { return e.touches ? e.touches[0].clientY : e.clientY; }

    function onMove(e: any) {
        mouseX = getX(e);
        mouseY = getY(e);
        
        if (activeWrapper) {
            activeWrapper.dragX = mouseX - startMouseX;
            activeWrapper.dragY = mouseY - startMouseY;
        }
    }

    function onDown(e: any) {
        const target = e.target.closest('.anim-element, .g-particle');
        if (target) {
            activeWrapper = target.closest('.parallax-wrapper');
            if (activeWrapper) {
                if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                   //e.preventDefault(); 
                }
                
                activeWrapper.isSpringing = false;
                startMouseX = getX(e) - activeWrapper.dragX;
                startMouseY = getY(e) - activeWrapper.dragY;
                activeWrapper.style.zIndex = '100';
            }
        }
    }

    function onUp() {
        if (activeWrapper) {
            activeWrapper.style.zIndex = '';
            springBack(activeWrapper);
            activeWrapper = null;
        }
    }

    function springBack(wrapper: any) {
        wrapper.isSpringing = true;
        const spring = () => {
            if (!wrapper.isSpringing) return;
            
            wrapper.dragX += (0 - wrapper.dragX) * 0.15;
            wrapper.dragY += (0 - wrapper.dragY) * 0.15;
            
            if (Math.abs(wrapper.dragX) < 0.5 && Math.abs(wrapper.dragY) < 0.5) {
                wrapper.dragX = 0;
                wrapper.dragY = 0;
                wrapper.isSpringing = false;
            } else {
                requestAnimationFrame(spring);
            }
        };
        requestAnimationFrame(spring);
    }

    let animationFrameId: number;
    function render() {
        const xBase = (window.innerWidth / 2 - mouseX);
        const yBase = (window.innerHeight / 2 - mouseY);

        wrappers.forEach((wrapper: any) => {
            const speed = parseFloat(wrapper.getAttribute("data-speed")) || 10;
            const pX = (xBase * speed) / 1000;
            const pY = (yBase * speed) / 1000;
            
            const finalX = pX + wrapper.dragX;
            const finalY = pY + wrapper.dragY;
            
            wrapper.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
        });
        
        animationFrameId = requestAnimationFrame(render);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, {passive: false});
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);

    render();

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="landing-body">
      <div className="bg-circle circle-1"></div>
      <div className="bg-circle circle-2"></div>
      <div className="bg-circle circle-3"></div>

      <div className="global-particles">
          <div className="parallax-wrapper" data-speed="40"><div className="g-particle p-cross" style={{top: '15%', left: '5%', color: 'rgba(37, 99, 235, 0.5)', animationDelay: '-2s'}}></div></div>
          <div className="parallax-wrapper" data-speed="-30"><div className="g-particle p-cross" style={{bottom: '20%', left: '15%', color: 'rgba(236, 72, 153, 0.5)', animationDelay: '-5s'}}></div></div>
          <div className="parallax-wrapper" data-speed="25"><div className="g-particle p-cross" style={{top: '35%', right: '10%', color: 'rgba(52, 211, 153, 0.5)', animationDelay: '-1s'}}></div></div>
          <div className="parallax-wrapper" data-speed="-45"><div className="g-particle p-ring" style={{width: '40px', height: '40px', top: '10%', right: '25%', borderColor: 'rgba(96, 165, 250, 0.6)', animationDuration: '20s'}}></div></div>
          <div className="parallax-wrapper" data-speed="50"><div className="g-particle p-ring" style={{width: '60px', height: '60px', bottom: '15%', right: '30%', borderColor: 'rgba(251, 191, 36, 0.4)', animationDuration: '25s', animationDelay: '-7s'}}></div></div>
          <div className="parallax-wrapper" data-speed="-20"><div className="g-particle p-ring" style={{width: '25px', height: '25px', top: '60%', left: '8%', borderColor: 'rgba(239, 68, 68, 0.4)', animationDuration: '18s'}}></div></div>
          <div className="parallax-wrapper" data-speed="35"><div className="g-particle p-dot" style={{width: '14px', height: '14px', top: '80%', left: '30%', background: 'var(--pink)', animationDuration: '12s'}}></div></div>
          <div className="parallax-wrapper" data-speed="-55"><div className="g-particle p-dot" style={{width: '20px', height: '20px', top: '25%', left: '45%', background: 'var(--primary-blue)', animationDuration: '22s', animationDelay: '-3s'}}></div></div>
          <div className="parallax-wrapper" data-speed="60"><div className="g-particle p-dot" style={{width: '10px', height: '10px', top: '70%', right: '15%', background: 'var(--green)', animationDuration: '10s'}}></div></div>
          <div className="parallax-wrapper" data-speed="-40"><div className="g-particle p-dot" style={{width: '16px', height: '16px', top: '5%', left: '35%', background: 'var(--yellow)', animationDuration: '16s', animationDelay: '-8s'}}></div></div>
      </div>

      <nav className="landing-nav">
          <div className="logo">
              <svg width="clamp(24px, 4vw, 32px)" height="clamp(24px, 4vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--primary-blue)'}}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              Labirinto<span>.</span>
          </div>
      </nav>

      <header className="hero">
          <div className="hero-content">
              <h1 className="hero-title">
                Dê vida às suas ideias <br className="hero-br" />
                <span>com fluxogramas.</span>
              </h1>

              <div className="hero-buttons">
                  <div className="cta-wrapper">
                    <button onClick={onStart} className="btn-primary border-none cursor-pointer">
                      <span>Acessar o App</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                    <div className="hover-shape shape-1"></div>
                    <div className="hover-shape shape-2"></div>
                    <div className="hover-shape shape-3"></div>
                    <div className="hover-shape shape-4"></div>
                    <div className="hover-shape shape-5"></div>
                  </div>
              </div>
          </div>

          <div className="hero-visual">
              <div className="scene-container" id="scene" ref={sceneRef}>
                  <div className="parallax-wrapper" data-speed="15"><div className="anim-element blue-backdrop"></div></div>
                  <div className="parallax-wrapper" data-speed="-25"><div className="anim-element red-sphere"></div></div>
                  <div className="parallax-wrapper" data-speed="20"><div className="anim-element pink-cone"></div></div>
                  <div className="parallax-wrapper" data-speed="-15"><div className="anim-element glass-triangle"></div></div>
                  <div className="parallax-wrapper" data-speed="10"><div className="anim-element glass-ring"></div></div>
                  <div className="parallax-wrapper" data-speed="-40"><div className="anim-element mini-sphere-1"></div></div>
                  <div className="parallax-wrapper" data-speed="35"><div className="anim-element mini-sphere-2"></div></div>
                  
                  <div className="parallax-wrapper" data-speed="5">
                      <div className="anim-element document-container">
                          <div className="doc-header">
                              <div className="dot red"></div><div className="dot yellow"></div><div className="dot green"></div>
                          </div>
                          <div className="doc-grid"></div>
                          <div className="mock-flowchart">
                              <div className="mock-box primary"></div>
                              
                              <div className="line-v" style={{margin: '-20px 0'}}></div>
                              
                              <div className="row">
                                  <div className="line-h-bridge"></div>
                                  <div className="connectors"><div className="line-v"></div><div className="line-v"></div></div>
                                  <div className="mock-box pink"></div>
                                  <div className="mock-box pink"></div>
                              </div>
                              
                              <div className="row" style={{marginTop: '15px'}}>
                                  <div className="connectors"><div className="line-v"></div><div className="line-v"></div><div className="line-v"></div><div className="line-v"></div></div>
                                  <div className="mock-box green"></div><div className="mock-box orange"></div>
                                  <div className="mock-box green"></div><div className="mock-box orange"></div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="parallax-wrapper badge-layer" data-speed="20"><div className="anim-element floating-node"><div className="node-dot"></div> Processo</div></div>
                  <div className="parallax-wrapper badge-layer" data-speed="12"><div className="anim-element badge badge-1"><span>✨</span> IA Integrada</div></div>
                  <div className="parallax-wrapper badge-layer" data-speed="-18"><div className="anim-element badge badge-2">Labirinto</div></div>
                  <div className="parallax-wrapper badge-layer" data-speed="25"><div className="anim-element badge badge-3">Mapeamento</div></div>
                  <div className="parallax-wrapper badge-layer" data-speed="-20"><div className="anim-element badge badge-4">Automação</div></div>
                  <div className="parallax-wrapper badge-layer" data-speed="15"><div className="anim-element badge badge-5">Processos</div></div>
                  <div className="parallax-wrapper badge-layer" data-speed="-30"><div className="anim-element badge badge-6">Diagramas</div></div>
              </div>
          </div>
      </header>
    </div>
  );
};
