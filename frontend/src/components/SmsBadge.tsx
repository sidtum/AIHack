export function SmsBadge() {
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '2px 6px',
            borderRadius: 10,
            background: 'rgba(60,200,100,0.12)',
            border: '1px solid rgba(60,200,100,0.25)',
            color: '#6ee7a0',
            fontFamily: "'DM Sans', sans-serif",
            verticalAlign: 'middle',
            marginLeft: 6,
            flexShrink: 0,
        }}>
            SMS
        </span>
    );
}
