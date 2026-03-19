import "./Footer.css";

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <div className="foot-logo">
          o1 <span>lab</span>
        </div>
        <p className="foot-tagline">
          Browse equipment and consumables. Grab what you need.
        </p>
      </div>
      <div className="foot-col">
        <h5>Links</h5>
        <a href="https://o1lab.space">The Space</a>
        <a href="/">Store</a>
        <a href="https://o1lab.shop">Shop</a>
      </div>
      <div className="foot-col">
        <h5>Connect</h5>
        <a href="#">Instagram</a>
        <a href="#">Twitter / X</a>
        <a href="#">Discord</a>
        <a href="mailto:hello@o1lab.space">Email</a>
      </div>
      <div className="foot-bottom">
        <p>&copy; 2025 o1 lab</p>
        <p>Made in a garage in Sydney</p>
      </div>
    </footer>
  );
}
