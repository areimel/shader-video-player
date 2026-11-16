import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource-variable/archivo/wdth.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/panel.css";
import "./styles/widgets.css";
import "./styles/controls.css";
import "./styles/slider.css";
import "./styles/menu.css";
import "./styles/toast.css";
import "./styles/info.css";
import "./styles/empty.css";
import "./styles/queue.css";
import "./styles/effects.css";
import "./styles/subtitles.css";

createRoot(document.getElementById("root")!).render(<App />);
