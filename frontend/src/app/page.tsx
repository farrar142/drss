import { Button, Typography, Container, Box } from '@mui/material';

export default function Home() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Next.js + MUI + TypeScript
        </Typography>
        <Typography variant="body1" gutterBottom>
          Welcome to your new Next.js app with Material-UI!
        </Typography>
        <Button variant="contained" color="primary">
          Get Started
        </Button>
      </Box>
    </Container>
  );
}
