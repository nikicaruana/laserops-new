import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="eyebrow">Signal Lost</span>
      <h1 className="mt-4 text-7xl font-extrabold tracking-tight sm:text-8xl">
        4<span className="text-accent">0</span>4
      </h1>
      <p className="mt-6 max-w-md text-text-muted">
        This position is off the map. Return to base and try a different route.
      </p>
      <div className="mt-10">
        <Button href="/" variant="primary">
          Return to Home
        </Button>
      </div>
    </Container>
  );
}
