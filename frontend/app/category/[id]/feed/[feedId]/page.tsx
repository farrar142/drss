'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    Container,
} from '@mui/material';

export default function FeedPage() {
    const params = useParams();
    const feedId = parseInt(params.id as string);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        </Container>
    );
}