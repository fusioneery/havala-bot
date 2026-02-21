import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import CreateOrderPage from '@/pages/create-order';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="w-full h-dvh flex flex-col bg-background text-foreground">
      <header className="px-6 pt-10 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Hawala Bot</h1>
        <p className="text-muted-foreground text-[15px] mt-1">
          Trust-based currency exchange matching
        </p>
      </header>

      <main className="flex-1 px-4">
        <div className="bg-card rounded-[24px] p-5 border border-border">
          <p className="text-muted-foreground text-[14px] mb-4">
            У вас пока нет активных заявок
          </p>
          <Button
            onClick={() => navigate('/create')}
            className="w-full bg-primary hover:opacity-90 text-primary-foreground h-[52px] rounded-[20px] font-bold text-[16px]"
          >
            Новый обмен
          </Button>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateOrderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
