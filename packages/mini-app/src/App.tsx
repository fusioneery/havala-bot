import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function App() {
  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Hawala Bot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Trust-based currency exchange matching.
          </p>
          <Button className="w-full">New Exchange</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
