import { BrowserRouter, Routes, Route } from "react-router-dom";

import Customers from "./pages/Customers";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Customers />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;