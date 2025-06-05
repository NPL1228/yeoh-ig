// 导航栏滚动效果
const navbar = document.getElementById('navbar');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');

// 滚动监听
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('navbar-scrolled');
  } else {
    navbar.classList.remove('navbar-scrolled');
  }
});

// 移动端菜单
mobileMenuButton.addEventListener('click', () => {
  mobileMenu.classList.toggle('hidden');
});

// 点击导航链接关闭移动菜单
const navLinks = document.querySelectorAll('#mobile-menu a');
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
  });
});

// 添加平滑滚动效果
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      window.scrollTo({
        top: targetElement.offsetTop - 80, // 减去导航栏高度
        behavior: 'smooth'
      });
    }
  });
});

// 动画效果
document.addEventListener('DOMContentLoaded', () => {
  // 为价格卡片添加类
  const priceCards = document.querySelectorAll('#pricing .bg-white');
  priceCards.forEach(card => {
    card.classList.add('price-card');
  });
  
  // 为按钮添加类
  const buttons = document.querySelectorAll('a[href^="#"], button');
  buttons.forEach(button => {
    button.classList.add('btn-hover-effect');
  });
  
  // 为图片添加类
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.classList.add('img-hover-effect');
  });
  
  // 为步骤数字添加类
  const stepNumbers = document.querySelectorAll('#how-it-works .w-16');
  stepNumbers.forEach(step => {
    step.classList.add('step-number');
  });
  
  // 滚动动画
  const animateOnScroll = () => {
    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(element => {
      const elementPosition = element.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;
      
      if (elementPosition < windowHeight - 100) {
        element.classList.add('animate-fadeInUp');
      }
    });
  };
  
  // 为各部分添加动画类
  const sections = document.querySelectorAll('section > div > h2, section > div > div');
  sections.forEach(section => {
    section.classList.add('animate-on-scroll');
  });
  
  // 初始执行和滚动时执行
  animateOnScroll();
  window.addEventListener('scroll', animateOnScroll);
});