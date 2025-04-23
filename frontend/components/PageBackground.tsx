import React from 'react';

// Componente para criar estrelas no fundo
const Stars = () => {
  const stars = Array.from({ length: 70 }).map((_, i) => {
    const size = Math.random() * 3 + 1;
    const animationDuration = Math.random() * 3 + 2;
    const animationDelay = Math.random() * 5;
    
    return (
      <div 
        key={i}
        className="star"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          opacity: Math.random() * 0.7 + 0.3,
          animationDuration: `${animationDuration}s`,
          animationDelay: `${animationDelay}s`
        }}
      />
    );
  });
  
  return <div className="fixed inset-0 z-0 overflow-hidden">{stars}</div>;
};

// Componente para criar partículas orbitando
const OrbitingParticles = () => {
  const particles = Array.from({ length: 6 }).map((_, i) => {
    const size = Math.random() * 6 + 4;
    const distance = Math.random() * 10 + 10;
    const duration = Math.random() * 20 + 25;
    const delay = Math.random() * -20;
    const color = `rgba(${Math.floor(Math.random() * 100) + 100}, 0, ${Math.floor(Math.random() * 155) + 100}, 0.4)`;
    
    return (
      <div 
        key={i}
        className="absolute rounded-full orbit"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: color,
          boxShadow: `0 0 ${size * 2}px ${size / 2}px ${color}`,
          left: `calc(50% - ${size/2}px)`,
          top: `calc(50% - ${size/2}px)`,
          transformOrigin: `${distance}px ${distance}px`,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`
        }}
      />
    );
  });
  
  return <div className="fixed inset-0 z-0 overflow-hidden">{particles}</div>;
};

const PageBackground = () => {
  return (
    <>
      {/* Background elements */}
      <Stars />
      <OrbitingParticles />
      
      {/* Light effects */}
      <div className="fixed top-1/4 -left-20 w-60 h-60 bg-purple-600/20 rounded-full filter blur-[80px] z-0"></div>
      <div className="fixed bottom-1/3 -right-20 w-80 h-80 bg-indigo-600/20 rounded-full filter blur-[100px] z-0"></div>
    </>
  );
};

export default PageBackground; 