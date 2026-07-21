import AppProviders from "./app/AppProviders";
import AppRouter from "./app/AppRouter";
import "./App.css";

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}