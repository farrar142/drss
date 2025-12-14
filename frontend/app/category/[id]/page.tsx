'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Container,
} from '@mui/material';

export default function CategoryPage() {
    const params = useParams();
    const router = useRouter();


    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        </Container>
    );
}