export function SmsBadge() {
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 10,
            background: 'rgba(125, 216, 184, 0.08)',
            border: '1px solid rgba(125, 216, 184, 0.22)',
            color: '#7DD8B8',
            fontFamily: "'JetBrains Mono', monospace",
            verticalAlign: 'middle',
            marginLeft: 6,
            flexShrink: 0,
        }}>
            SMS
        </span>
    );
}
