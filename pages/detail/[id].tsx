import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import {
  Row,
  Col,
  Button,
  Table,
  TableColumnProps,
  notification,
  Space,
  Statistic,
  Spin,
  Tooltip,
  Tag
} from 'antd'
import {
  ShareAltOutlined,
  DoubleRightOutlined,
  LoadingOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { formatMoney } from 'accounting'
import moment from 'moment'
import useSWR from 'swr'

import Layout from '../../components/layout'
import Card from '../../components/card'
import PriceInput from '../../components/price-input'
import QuotedPriceModal from '../../components/quoted-price-modal'
import SellModal from '../../components/sell-modal'
import ShareModal from '../../components/share-modal'
import useMe from '../../hooks/use-me'
import useIsMobile from '../../hooks/use-is-mobile'
import fetchWeibo from '../../lib/fetch-weibo'
import fetchRecords from '../../lib/fetch-records'
import fetcher from '../../lib/fetcher'
import { CardDataType, CardStatus, StatDataType } from '../../typings/card'
import {
  RecordItemDataType,
  RecordItemTypeMap,
  MyOfferType,
  SellDataType,
  WinResultType,
  FinalDataType
} from '../../typings/record'
import { PaymentUrlType } from '../../typings/payment'
import styles from '../../styles/detail.module.css'

const { Countdown } = Statistic

export interface DetailProps {
  cardStatus: CardStatus
  cardData?: CardDataType
}

export default function Detail({ cardData, cardStatus }: DetailProps) {
  const router = useRouter()
  const { query } = router
  const { me } = useMe()
  const isMobile = useIsMobile()
  const [records, setRecords] = useState<RecordItemDataType[]>([])
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(true)
  const [recordsPage, setRecordsPage] = useState<number>(1)
  const [price, setPrice] = useState<number>()
  const [myOffer, setMyOffer] = useState<MyOfferType>()
  const [sellData, setSellData] = useState<SellDataType>()
  const [sendConfirmVisible, setSendConfirmVisible] = useState<boolean>(false)
  const [sellConfirmVisible, setSellConfirmVisible] = useState<boolean>(false)
  const [shareVisible, setShareVisible] = useState<boolean>(false)
  const [shouldSendRequest, setShouldSendRequest] = useState<boolean>(false)
  const [shouldSellRequest, setShouldSellRequest] = useState<boolean>(false)
  const [shouldFetchMyOffer, setShouldFetchMyOffer] = useState<boolean>(false)
  const [shouldFetchMoreRecords, setShouldFetchMoreRecords] = useState<boolean>(
    true
  )
  const [shouldPaymentRequest, setShouldPaymentRequest] = useState<boolean>(
    false
  )

  // ??????????????????/?????????
  const isCreator = me?.isLoggedIn && me.id === cardData?.creator?.id
  // ??????????????????
  const isHolder = me?.isLoggedIn && me.id === cardData?.holder?.id
  // ??????????????????
  const hasBeenSold = cardStatus === 1
  // ??????????????????
  const canPurchased = me?.isLoggedIn && hasBeenSold ? !isHolder : !isCreator

  useEffect(() => {
    if (me?.isLoggedIn && !hasBeenSold) {
      setShouldFetchMyOffer(true)
    }
  }, [hasBeenSold, me?.isLoggedIn])

  // ??????????????????????????????
  const {
    isValidating: fetchMoreRecordsValidating = true,
    mutate: mutateFetchMoreRecords
  } = useSWR<RecordItemDataType[]>(
    shouldFetchMoreRecords && hasMoreRecords
      ? `/api/records?id=${query.id}&pageSize=20&current=${recordsPage}`
      : null,
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        setShouldFetchMoreRecords(false)
        if (!data.length) {
          setHasMoreRecords(false)
          return
        }
        setRecords(recordsPage === 1 ? data : records.concat(data))
      }
    }
  )

  // ???????????????????????????
  const {
    data: hasWon,
    isValidating: hasWonValidating
  } = useSWR<WinResultType>(
    me?.isLoggedIn && canPurchased ? `/api/my/win?id=${query.id}` : null,
    { revalidateOnFocus: false }
  )

  // ?????????????????????
  const { data: selling, isValidating: sellingValidating = true } = useSWR<
    string[]
  >(
    !canPurchased && !fetchMoreRecordsValidating
      ? `/api/selling?id=${query.id}`
      : null,
    {
      revalidateOnFocus: false
    }
  )

  // ?????????????????????
  const { data: final } = useSWR<FinalDataType>(
    me?.isLoggedIn && hasBeenSold ? `/api/final?id=${query.id}` : null,
    {
      revalidateOnFocus: false
    }
  )

  // ????????????????????????
  const {
    isValidating: fetchMyOfferValidating = true,
    mutate: mutateFetchMyOffer
  } = useSWR<MyOfferType>(
    shouldFetchMyOffer ? `/api/my/offer?id=${query.id}` : null,
    {
      onSuccess: (data) => {
        if (data.price && data.expire) setMyOffer(data)
        setShouldFetchMyOffer(false)
      }
    }
  )

  // ????????????????????????
  const {
    data: statData,
    isValidating: fetchStatDataValidating = true,
    mutate: mutateFetchStatData
  } = useSWR<StatDataType>(`/api/card/stat?id=${query.id}`, {
    revalidateOnFocus: false
  })

  // ??????????????????
  const { isValidating: sendLoading = false } = useSWR(
    shouldSendRequest ? '/api/offer' : null,
    (url) =>
      fetcher(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ id: query.id, price })
      }),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onSuccess: () => {
        notification.success({ message: '????????????' })
        setPrice(undefined)
        setShouldSendRequest(false)
        setSendConfirmVisible(false)
        setShouldFetchMyOffer(true)
        setShouldFetchMoreRecords(true)
        setHasMoreRecords(true)
        setRecordsPage(1)
        mutateFetchMyOffer()
        mutateFetchMoreRecords()
        mutateFetchStatData()
      },
      onError: () => {
        notification.error({ message: '??????????????????????????????' })
        setShouldSendRequest(false)
      }
    }
  )

  // ?????????Ta??????
  const { isValidating: sellLoading = false } = useSWR(
    shouldSellRequest ? '/api/sell' : null,
    (url) =>
      fetcher(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ id: sellData?.id })
      }),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onSuccess: () => {
        notification.success({ message: '????????????' })
        setShouldSellRequest(false)
        setSellConfirmVisible(false)
        setShouldFetchMoreRecords(true)
        setHasMoreRecords(true)
        setRecordsPage(1)
        mutateFetchMoreRecords()
      },
      onError: () => {
        notification.error({ message: '????????????????????????' })
        setShouldSellRequest(false)
      }
    }
  )

  // ????????????????????????
  const { isValidating: paymentLoading = false } = useSWR<PaymentUrlType>(
    shouldPaymentRequest ? '/api/payment' : null,
    (url) =>
      fetcher(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          orderId: hasWon?.orderId,
          returnUrl: location.href
        })
      }),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onSuccess: (data) => {
        setShouldPaymentRequest(false)
        const a = document.createElement('a')
        a.target = '_blank'
        a.href = data.paymentUrl
        a.click()
      },
      onError: () => {
        notification.error({ message: '????????????????????????????????????' })
        setShouldPaymentRequest(false)
      }
    }
  )

  const columns: TableColumnProps<RecordItemDataType>[] = [
    {
      title: '??????',
      key: 'type',
      dataIndex: 'type',
      render: (value) => RecordItemTypeMap[value]
    },
    {
      title: '??????',
      key: 'time',
      dataIndex: 'time',
      render: (value) => moment(value).format('YYYY/MM/DD HH:mm')
    },
    {
      title: '????????????',
      key: 'user.name',
      dataIndex: ['user', 'name']
    },
    {
      title: '??????',
      key: 'price',
      dataIndex: 'price',
      render: (value) => formatMoney(value, '?? ')
    },
    {
      render: (_, item) => (
        <>
          {me?.isLoggedIn && !canPurchased && item.type === 0 && !item.expire && (
            <div className={styles['table-action']}>
              <Space>
                {!sellingValidating && selling && selling.length === 0 && (
                  <Button
                    type="primary"
                    size="small"
                    shape="round"
                    onClick={() => {
                      setSellData({
                        id: item.id,
                        price: item.price,
                        name: item.user.name
                      })
                      setSellConfirmVisible(true)
                    }}
                  >
                    ?????????Ta
                  </Button>
                )}
                {!sellingValidating &&
                  selling &&
                  selling.includes(item.user.id) && (
                    <Tag color="#1858f9">????????????</Tag>
                  )}
              </Space>
            </div>
          )}
          {me?.isLoggedIn && item.expire && (
            <div className={styles['table-action']}>
              <Space>
                <Tag color="#000" style={{ opacity: 0.3 }}>
                  ?????????
                </Tag>
              </Space>
            </div>
          )}
        </>
      )
    }
  ]

  // ??????
  const onSend = () => {
    if (!price || price < 10 || String(price / 10).indexOf('.') !== -1) {
      notification.error({
        message: '?????????????????????10????????????'
      })
      return
    }
    setSendConfirmVisible(true)
  }

  // ????????????
  const onSendOk = () => setShouldSendRequest(true)

  // ????????????????????????
  const onLoadMore = () => {
    setRecordsPage(recordsPage + 1)
    setShouldFetchMoreRecords(true)
  }

  // ??????????????????
  const onReloadRecords = () => {
    setShouldFetchMoreRecords(true)
    setHasMoreRecords(true)
    setRecordsPage(1)
    mutateFetchMoreRecords()
  }

  // ???????????????Ta
  const onSellOk = () => setShouldSellRequest(true)

  // ?????????
  const onPayment = () => setShouldPaymentRequest(true)

  return (
    <Layout>
      <ShareModal
        visible={shareVisible}
        cardData={cardData}
        price={
          hasBeenSold
            ? final
              ? final?.price
              : undefined
            : records.length !== 0
            ? records[0].price
            : undefined
        }
        time={
          hasBeenSold
            ? final
              ? final?.time
              : undefined
            : records.length !== 0
            ? records[0].time
            : undefined
        }
        onClose={() => setShareVisible(false)}
      />
      <SellModal
        price={sellData?.price}
        name={sellData?.name}
        visible={sellConfirmVisible}
        loading={sellLoading}
        onOk={onSellOk}
        onCancel={() => setSellConfirmVisible(false)}
      />
      <QuotedPriceModal
        price={price}
        visible={sendConfirmVisible}
        loading={sendLoading}
        onOk={onSendOk}
        onCancel={() => setSendConfirmVisible(false)}
      />
      <div className="container">
        <Row gutter={{ xs: 0, sm: 6 }} className={styles.showcase}>
          <Col xs={24} sm={9}>
            <Card arrows type="simple" photoPreview={false} data={cardData} />
          </Col>
          <Col xs={24} sm={1}>
            <div className={styles.tools}>
              <Button
                className={styles.btn}
                onClick={() => setShareVisible(true)}
                icon={<ShareAltOutlined size={18} />}
              />
            </div>
          </Col>
          <Col xs={24} sm={14}>
            <div className={styles.main}>
              <div className={styles.users}>
                <div className={styles.u}>
                  Creator:
                  <span>{cardData?.creator ? cardData.creator.name : '-'}</span>
                </div>
                {cardData?.holder &&
                  cardData.creator.id !== cardData.holder.id && (
                    <div className={styles.u}>
                      Holder:
                      <span>{cardData.holder.name}</span>
                    </div>
                  )}
              </div>
              {/* {me?.isLoggedIn && hasBeenSold && (
                <div className={styles['price-info']}>
                  <div className={styles.title}>???????????????</div>
                  <div className={styles.high}>
                    {finalValidating && !final && (
                      <Spin
                        indicator={<LoadingOutlined className={styles.spin} />}
                      />
                    )}
                    {final && <>{formatMoney(final.price, '?? ')}</>}
                  </div>
                  <div className={styles.help}>
                    ?????????????????????????????????????????????
                  </div>
                </div>
              )} */}
              {me?.isLoggedIn && !canPurchased && (
                <div className={styles['price-info']}>
                  <div className={styles.title}>???????????????</div>
                  <div className={styles.high}>
                    {fetchStatDataValidating && !statData && (
                      <Spin
                        indicator={<LoadingOutlined className={styles.spin} />}
                      />
                    )}
                    {statData && <>{formatMoney(statData.highPrice, '?? ')}</>}
                  </div>
                </div>
              )}
              {me?.isLoggedIn && canPurchased && (
                <>
                  {hasWonValidating && (
                    <Spin
                      className={styles['main-loader']}
                      indicator={<LoadingOutlined className={styles.spin} />}
                    />
                  )}
                  {!hasWonValidating && hasWon?.result && hasWon.price && (
                    <div className={styles.win}>
                      <div className={styles.title}>
                        ?????????????????????????????? {formatMoney(hasWon.price, '?? ')}
                      </div>
                      <div className={styles.help}>
                        ??????
                        <Countdown
                          valueStyle={{
                            fontSize: 14,
                            fontWeight: 'bold',
                            marginLeft: 5,
                            marginRight: 5,
                            color: '#1858f9'
                          }}
                          value={hasWon.expire}
                          format="H ?????? m ??? s ???"
                        />
                        ?????????
                      </div>
                      <div className={styles.help}>
                        ??????24????????????????????????24???????????????????????????20???????????????
                        ???????????????60?????????????????????
                      </div>
                      <div className={styles.btns}>
                        <div className={styles.column}>
                          <Button
                            block
                            className={styles.pay}
                            type="primary"
                            size="large"
                            onClick={onPayment}
                            loading={paymentLoading}
                          >
                            ?????????
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {!hasWonValidating && !hasWon?.result && (
                    <div className={`${styles['send-price']} send-price`}>
                      {!fetchMyOfferValidating && myOffer && (
                        <div className={styles.prompt}>
                          <div>
                            ??????????????????{formatMoney(myOffer.price, '?? ')}
                            ????????????
                          </div>
                          <Countdown
                            valueStyle={{ fontSize: 14, marginLeft: 5 }}
                            value={myOffer.expire}
                            format="H ?????? m ??? s ???"
                          />
                        </div>
                      )}
                      {!fetchMyOfferValidating && !myOffer && (
                        <div className={styles.prompt}>??????????????????</div>
                      )}
                      {fetchMyOfferValidating && (
                        <div className={styles.prompt}>?????????????????????...</div>
                      )}
                      <div className={styles.input}>
                        <Row gutter={18}>
                          <Col xs={16} flex={!isMobile ? 'auto' : undefined}>
                            <PriceInput
                              value={price}
                              onChange={(value) => setPrice(value)}
                              size="large"
                              precision={0}
                              disabled={sendConfirmVisible}
                            />
                          </Col>
                          <Col xs={8} flex={!isMobile ? '150px' : undefined}>
                            <Button
                              block
                              className="btn"
                              type="primary"
                              size="large"
                              loading={sendConfirmVisible}
                              onClick={onSend}
                            >
                              ??????
                            </Button>
                          </Col>
                        </Row>
                        <div className={styles.help}>
                          <p>?????????????????????10????????????</p>
                          <p>
                            ???????????????????????????24???????????????????????????????????????20?????????
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {!me?.isLoggedIn && (
                <div className={styles.btns}>
                  <div className={styles.column}>
                    <Button
                      block
                      type="primary"
                      size="large"
                      onClick={() =>
                        router.push({
                          pathname: '/login',
                          query: { ref: encodeURIComponent(router.asPath) }
                        })
                      }
                    >
                      ??? ??? ???
                    </Button>
                  </div>
                </div>
              )}
              <div className={styles.statistics}>
                <Row gutter={4}>
                  <Col xs={6} span={8}>
                    <div className={styles.title}>????????????</div>
                    <div className={`${styles.count} ${styles.first}`}>
                      {fetchStatDataValidating && !statData && (
                        <Spin
                          size="small"
                          indicator={
                            <LoadingOutlined className={styles.spin} />
                          }
                        />
                      )}
                      {statData && (
                        <>
                          <span>{statData.offerTotal}</span>
                          <i>???</i>
                        </>
                      )}
                    </div>
                  </Col>
                  <Col xs={9} span={8}>
                    <div className={styles.title}>??????????????????</div>
                    <div className={styles.count}>
                      {fetchStatDataValidating && !statData && (
                        <Spin
                          size="small"
                          indicator={
                            <LoadingOutlined className={styles.spin} />
                          }
                        />
                      )}
                      {statData && (
                        <span>{formatMoney(statData.highPrice, '?? ')}</span>
                      )}
                    </div>
                  </Col>
                  <Col xs={9} span={8}>
                    <div className={styles.title}>??????????????????</div>
                    <div className={`${styles.count} ${styles.last}`}>
                      {fetchStatDataValidating && !statData && (
                        <Spin
                          size="small"
                          indicator={
                            <LoadingOutlined className={styles.spin} />
                          }
                        />
                      )}
                      {statData && (
                        <span>{formatMoney(statData.averagePrice, '?? ')}</span>
                      )}
                    </div>
                  </Col>
                </Row>
              </div>
            </div>
          </Col>
        </Row>
        <div className={styles.table}>
          <Table
            title={() => (
              <div className={styles.header}>
                ????????????
                <Tooltip title="??????">
                  <a onClick={onReloadRecords}>
                    <ReloadOutlined />
                  </a>
                </Tooltip>
              </div>
            )}
            columns={columns}
            pagination={false}
            rowKey="id"
            dataSource={records}
            scroll={isMobile ? { x: 700 } : {}}
          />
          {hasMoreRecords && (
            <div className={styles.loadmore}>
              {!fetchMoreRecordsValidating && (
                <DoubleRightOutlined
                  className={styles.icon}
                  onClick={onLoadMore}
                />
              )}
              {fetchMoreRecordsValidating && (
                <Spin indicator={<LoadingOutlined />} />
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps<
  DetailProps,
  { id: string }
> = async ({ params }) => {
  if (params?.id.length !== 16 || !/^[0-9]+$/.test(params.id)) {
    return { notFound: true }
  }

  let state: DetailProps = {
    cardStatus: 0
  }

  let holder

  try {
    const records = await fetchRecords(params.id)
    const { ownerId, ownerName } = records

    if (ownerId && ownerName) {
      state = {
        ...state,
        cardStatus: 1
      }
      holder = {
        id: ownerId,
        name: ownerName
      }
    }
  } catch (error) {
    console.error(error)
  }

  try {
    const weibo = await fetchWeibo(params.id)
    if (weibo) {
      const weiboData = weibo.data.data
      state = {
        ...state,
        cardData: {
          id: weiboData.id,
          creator: {
            id: weiboData.user.id.toString(),
            avatar: weiboData.user.profile_image_url,
            name: weiboData.user.screen_name
          },
          content: weiboData.text,
          // .replace('https://', `${process.env.API_BASE}/sinaimg/`)
          thumbnails: weiboData.pics
            ? weiboData.pics.map((item: any) => item.url)
            : [],
          repostsCount: weiboData.reposts_count,
          commentsCount: weiboData.comments_count,
          attitudesCount: weiboData.attitudes_count
        }
      }
      if (holder && state.cardData) {
        state.cardData.holder = holder
      }
    }
  } catch (error) {
    console.error(error)
  }

  return { props: state }
}
