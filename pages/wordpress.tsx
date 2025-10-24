export async function getServerSideProps() {
  return {
    redirect: {
      destination: 'https://wordpress.org/plugins/usdc-payments-with-buyer-protection/',
      permanent: true, // 301 permanent redirect
    },
  }
}

export default function WordPressRedirect() {
  return null
}
